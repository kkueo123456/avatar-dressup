import { describe, expect, it } from 'vitest'
import type { SkinnedMesh } from 'three'
import { AvatarRig, PartBindError } from '@/avatar/AvatarRig'
import type { GltfSource, LoadedGltf } from '@/avatar/PartLoader'
import { collectSkinnedMeshes } from '@/avatar/rebind'
import { makeManifest, part } from './fixtures/manifest'
import { makeRig } from './fixtures/rig'

const BONES = ['root', 'pelvis', 'spine', 'head']
const m = makeManifest()
const female = m.bases[0]
const male = m.bases[1]
const url = (p: string) => `/avatar/${p}`

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

class FakeSource implements GltfSource {
  files = new Map<string, LoadedGltf>()
  gates = new Map<string, Promise<void>>()
  calls: string[] = []
  async load(u: string): Promise<LoadedGltf> {
    this.calls.push(u)
    await this.gates.get(u)
    const f = this.files.get(u)
    if (!f) throw new Error(`404 ${u}`)
    return f
  }
}

function setup() {
  const src = new FakeSource()
  src.files.set(url(female.url), { scene: makeRig(BONES, 'Body').root, animations: [] })
  src.files.set(url(male.url), { scene: makeRig(BONES, 'Body').root, animations: [] })
  for (const p of m.parts) src.files.set(url(p.url), { scene: makeRig(BONES, p.id).root, animations: [] })
  src.files.set(url('models/bad.glb'), { scene: makeRig(['root', 'pelvis', 'tail'], 'bad').root, animations: [] })
  const rig = new AvatarRig(src, url)
  return { src, rig }
}

function partMeshes(rig: AvatarRig): SkinnedMesh[] {
  return collectSkinnedMeshes(rig.root).filter((x) => x.name !== 'Body')
}

describe('AvatarRig', () => {
  it('setBase 后有骨骼、底模身体可见', async () => {
    const { rig } = setup()
    await rig.setBase(female)
    expect(rig.hasBase).toBe(true)
    expect(rig.boneCount).toBe(4)
    expect(rig.bodyVisible).toBe(true)
    expect(rig.getBone('head')?.name).toBe('head')
  })

  it('没有底模时 equip 报错', async () => {
    const { rig } = setup()
    await expect(rig.equip(part(m, 'ranger_body'))).rejects.toThrow('先设置底模')
  })

  it('equip 把部件网格绑到底模骨骼并挂到 root，unequip 后移除', async () => {
    const { rig } = setup()
    await rig.setBase(female)
    await rig.equip(part(m, 'ranger_body'))
    expect(rig.isEquipped('ranger_body')).toBe(true)
    const meshes = partMeshes(rig)
    expect(meshes.map((x) => x.name)).toEqual(['ranger_body'])
    expect(meshes[0].skeleton.bones[0]).toBe(rig.getBone('root'))
    rig.unequip('ranger_body')
    expect(rig.isEquipped('ranger_body')).toBe(false)
    expect(partMeshes(rig)).toEqual([])
  })

  it('重复 equip 同一部件只加载一次', async () => {
    const { rig, src } = setup()
    await rig.setBase(female)
    await rig.equip(part(m, 'hood'))
    await rig.equip(part(m, 'hood'))
    expect(src.calls.filter((c) => c === url(part(m, 'hood').url))).toHaveLength(1)
    expect(partMeshes(rig)).toHaveLength(1)
  })

  it('缺骨骼的部件抛 PartBindError 且不挂到场景', async () => {
    const { rig } = setup()
    await rig.setBase(female)
    const bad = { ...part(m, 'pauldron'), id: 'bad', url: 'models/bad.glb' }
    await expect(rig.equip(bad)).rejects.toBeInstanceOf(PartBindError)
    await rig.equip(bad).catch((e: PartBindError) => expect(e.missing).toEqual(['tail']))
    expect(rig.isEquipped('bad')).toBe(false)
    expect(partMeshes(rig)).toEqual([])
  })

  it('加载完成前被卸下的部件不会挂回场景', async () => {
    const { rig, src } = setup()
    await rig.setBase(female)
    const gate = deferred()
    const p = part(m, 'ranger_body')
    src.gates.set(url(p.url), gate.promise)
    const equipping = rig.equip(p)
    rig.unequip(p.id)
    gate.resolve()
    await equipping
    expect(rig.isEquipped(p.id)).toBe(false)
    expect(partMeshes(rig)).toEqual([])
  })

  it('换底模会清掉所有部件并恢复身体可见', async () => {
    const { rig } = setup()
    await rig.setBase(female)
    await rig.equip(part(m, 'ranger_body'))
    rig.setBodyVisible(false)
    await rig.setBase(male)
    expect(rig.equippedIds).toEqual([])
    expect(rig.bodyVisible).toBe(true)
    expect(rig.boneCount).toBe(4)
  })

  it('setBodyVisible 只影响 bodyMeshes', async () => {
    const { rig } = setup()
    await rig.setBase(female)
    rig.setBodyVisible(false)
    expect(rig.bodyVisible).toBe(false)
    rig.setBodyVisible(true)
    expect(rig.bodyVisible).toBe(true)
  })
})
