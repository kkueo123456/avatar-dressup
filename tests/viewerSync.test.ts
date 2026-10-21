import { describe, expect, it, vi } from 'vitest'
import type { AnimationRef, BaseModel, Part } from '@/types/manifest'
import { createAvatarStore } from '@/state/avatarStore'
import { createViewerSync, diffEquipped, type ViewerLike } from '@/state/viewerSync'
import { makeManifest, part } from './fixtures/manifest'

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

class FakeViewer implements ViewerLike {
  calls: string[] = []
  equipped = new Set<string>()
  base = ''
  failEquip = new Set<string>()
  throwOnUnequip = false
  gates = new Map<string, Promise<void>>()
  async setBase(b: BaseModel) { this.calls.push(`base:${b.id}`); this.base = b.id; this.equipped.clear() }
  async equip(p: Part) {
    this.calls.push(`equip:${p.id}`)
    await this.gates.get(p.id)
    if (this.failEquip.has(p.id)) throw new Error('boom')
    this.equipped.add(p.id)
  }
  unequip(id: string) {
    this.calls.push(`unequip:${id}`)
    if (this.throwOnUnequip) { this.throwOnUnequip = false; throw new Error('unequip boom') }
    this.equipped.delete(id)
  }
  async playAnimation(a: AnimationRef) { this.calls.push(`anim:${a.id}`) }
}

function setup() {
  const m = makeManifest()
  const store = createAvatarStore(m)
  const viewer = new FakeViewer()
  const onError = vi.fn()
  const sync = createViewerSync(store, viewer, m, onError)
  return { m, store, viewer, sync, onError }
}

describe('diffEquipped', () => {
  it('算出新增与移除', () => {
    expect(diffEquipped({ a: ['x'], b: ['y'] }, { a: ['x', 'z'], b: [] })).toEqual({ added: ['z'], removed: ['y'] })
  })
})

describe('createViewerSync', () => {
  it('启动时设置底模、播放待机动画', async () => {
    const { viewer, sync } = setup()
    await sync.idle()
    expect(viewer.calls).toEqual(['base:male_regular', 'anim:idle'])
  })

  it('装一件服装后四件都装上；卸下后调用 unequip', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    store.getState().equip(part(m, 'ranger_body'))
    await sync.idle()
    expect([...viewer.equipped].sort()).toEqual(['ranger_arms', 'ranger_body', 'ranger_feet', 'ranger_legs'])
    store.getState().unequip('body')
    await sync.idle()
    expect(viewer.calls).toContain('unequip:ranger_body')
    expect(viewer.equipped.has('ranger_body')).toBe(false)
  })

  it('只改 activeSlot 不会触发任何 viewer 调用', async () => {
    const { store, viewer, sync } = setup()
    await sync.idle()
    const before = viewer.calls.length
    store.getState().setActiveSlot('body')
    await sync.idle()
    expect(viewer.calls.length).toBe(before)
  })

  it('装失败的部件上报错误并从状态移除', async () => {
    const { m, store, viewer, sync, onError } = setup()
    viewer.failEquip.add('hood')
    await sync.idle()
    store.getState().equip(part(m, 'hood'))
    await sync.idle()
    expect(onError).toHaveBeenCalledWith('hood', expect.any(Error))
    expect(store.getState().avatar.equipped.accessory).toEqual([])
    expect(viewer.equipped.has('hood')).toBe(false)
  })

  it('换底模后重新装回仍匹配的部件', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    store.getState().equip(part(m, 'hair_m'))
    store.getState().equip(part(m, 'ranger_body'))
    await sync.idle()
    store.getState().setBase(m.bases[0])
    await sync.idle()
    expect(viewer.base).toBe('female_regular')
    expect(viewer.equipped.has('hair_m')).toBe(false)
    expect(viewer.equipped.has('ranger_body')).toBe(true)
    expect(viewer.calls.filter((c) => c === 'anim:idle')).toHaveLength(2)
  })

  it('加载完成前卸下：最终不保留该部件', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    const gate = deferred()
    viewer.gates.set('ranger_body', gate.promise)
    store.getState().equip(part(m, 'ranger_body'))
    for (let i = 0; i < 10 && !viewer.calls.includes('equip:ranger_body'); i++) await tick()
    expect(viewer.calls).toContain('equip:ranger_body')
    store.getState().unequip('body')
    gate.resolve()
    await sync.idle()
    expect(viewer.equipped.has('ranger_body')).toBe(false)
    expect(viewer.calls).toContain('unequip:ranger_body')
  })

  it('unequip 抛错不会毒化队列', async () => {
    const { m, store, viewer, sync, onError } = setup()
    await sync.idle()
    store.getState().equip(part(m, 'hood'))
    await sync.idle()
    viewer.throwOnUnequip = true
    store.getState().unequip('accessory')
    await expect(sync.idle()).resolves.toBeUndefined()
    expect(onError).toHaveBeenCalledWith('sync', expect.any(Error))
    store.getState().equip(part(m, 'hair_f'))
    await sync.idle()
    expect(viewer.calls).toContain('equip:hair_f')
  })

  it('stop 之后状态变化不再同步', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    sync.stop()
    store.getState().equip(part(m, 'hood'))
    await tick()
    expect(viewer.calls).not.toContain('equip:hood')
  })
})
