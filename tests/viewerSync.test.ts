import { describe, expect, it, vi } from 'vitest'
import type { AnimationRef, BaseModel, Part, Variant } from '@/types/manifest'
import { useAvatarState } from '@/state/useAvatarState'
import { createViewerSync, diffEquipped, type ViewerLike } from '@/state/viewerSync'
import { makeManifest, part } from './fixtures/manifest'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((r) => { resolve = r })
  return { promise, resolve }
}

class FakeViewer implements ViewerLike {
  calls: string[] = []
  equipped = new Set<string>()
  variants = new Map<string, string | null>()
  body = true
  base = ''
  failEquip = new Set<string>()
  gates = new Map<string, Promise<void>>()
  async setBase(b: BaseModel) { this.calls.push(`base:${b.id}`); this.base = b.id; this.equipped.clear() }
  async equip(p: Part) {
    this.calls.push(`equip:${p.id}`)
    await this.gates.get(p.id)
    if (this.failEquip.has(p.id)) throw new Error('boom')
    this.equipped.add(p.id)
  }
  unequip(id: string) { this.calls.push(`unequip:${id}`); this.equipped.delete(id) }
  setBodyVisible(v: boolean) { this.body = v }
  async setVariant(p: Part, v: Variant | null) { this.variants.set(p.id, v?.id ?? null) }
  async playAnimation(a: AnimationRef) { this.calls.push(`anim:${a.id}`) }
}

function setup() {
  const m = makeManifest()
  const store = useAvatarState(m)
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
  it('启动时设置底模、播放待机动画、身体可见', async () => {
    const { viewer, sync } = setup()
    await sync.idle()
    expect(viewer.calls).toEqual(['base:female_regular', 'anim:idle'])
    expect(viewer.body).toBe(true)
  })

  it('装一件服装后四件都装上，身体隐藏；卸下后调用 unequip', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    store.equip(part(m, 'ranger_body'))
    await sync.idle()
    expect([...viewer.equipped].sort()).toEqual(['ranger_arms', 'ranger_body', 'ranger_feet', 'ranger_legs'])
    expect(viewer.body).toBe(false)
    store.unequip('body')
    await sync.idle()
    expect(viewer.calls).toContain('unequip:ranger_body')
    expect(viewer.equipped.has('ranger_body')).toBe(false)
  })

  it('装失败的部件上报错误并从状态移除', async () => {
    const { m, store, viewer, sync, onError } = setup()
    viewer.failEquip.add('hood')
    await sync.idle()
    store.equip(part(m, 'hood'))
    await sync.idle()
    expect(onError).toHaveBeenCalledWith('hood', expect.any(Error))
    expect(store.state.avatar.equipped.accessory).toEqual([])
    expect(viewer.equipped.has('hood')).toBe(false)
  })

  it('换底模后重新装回仍匹配的部件', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    store.equip(part(m, 'hair_f'))
    store.equip(part(m, 'ranger_body'))
    await sync.idle()
    store.setBase(m.bases[1])
    await sync.idle()
    expect(viewer.base).toBe('male_regular')
    expect(viewer.equipped.has('hair_f')).toBe(false)
    expect(viewer.equipped.has('ranger_body')).toBe(true)
    expect(viewer.calls.filter((c) => c === 'anim:idle')).toHaveLength(2)
  })

  it('变体切换与恢复', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    store.equip(part(m, 'ranger_body'))
    await sync.idle()
    store.setVariant('ranger_body', 'b')
    await sync.idle()
    expect(viewer.variants.get('ranger_body')).toBe('b')
  })

  it('加载完成前卸下：最终不保留该部件', async () => {
    const { m, store, viewer, sync } = setup()
    await sync.idle()
    const gate = deferred()
    viewer.gates.set('ranger_body', gate.promise)
    store.equip(part(m, 'ranger_body'))
    store.unequip('body')
    gate.resolve()
    await sync.idle()
    expect(viewer.equipped.has('ranger_body')).toBe(false)
  })
})
