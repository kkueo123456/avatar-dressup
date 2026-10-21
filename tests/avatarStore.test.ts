import { describe, expect, it } from 'vitest'
import {
  createAvatarStore, selectBase, selectCurrentPreset, selectEquippedCount, selectEquippedIds,
  selectPartsInActiveSlot, selectVisibleSlots,
} from '@/state/avatarStore'
import { makeManifest, part } from './fixtures/manifest'

describe('createAvatarStore', () => {
  it('初始为男性底模（男性优先）、全空、第一个槽位激活', () => {
    const m = makeManifest()
    const store = createAvatarStore(m)
    const s = store.getState()
    expect(s.avatar.baseId).toBe('male_regular')
    expect(s.activeSlot).toBe('hair')
    expect(selectBase(m, s).id).toBe('male_regular')
    expect(selectPartsInActiveSlot(m, s).map((p) => p.id)).toEqual(['hair_m'])
    expect(selectVisibleSlots(m, s).map((x) => x.id)).toEqual(
      m.slots.map((x) => x.id).filter((id) => id !== 'eyebrows'),
    )
    expect(selectEquippedCount(s)).toBe(0)
    expect(selectCurrentPreset(m, s)).toBeNull()
  })

  it('每次动作都产生新的 avatar 对象，没动作时引用不变', () => {
    const m = makeManifest()
    const store = createAvatarStore(m)
    const a0 = store.getState().avatar
    store.getState().setActiveSlot('body')
    expect(store.getState().avatar).toBe(a0)
    store.getState().equip(part(m, 'ranger_body'))
    expect(store.getState().avatar).not.toBe(a0)
  })

  it('toggle：单选槽位重复点击保持，多选槽位重复点击卸下', () => {
    const m = makeManifest()
    const store = createAvatarStore(m)
    store.getState().toggle(part(m, 'ranger_body'))
    store.getState().toggle(part(m, 'ranger_body'))
    expect(store.getState().avatar.equipped.body).toEqual(['ranger_body'])
    store.getState().toggle(part(m, 'hood'))
    store.getState().toggle(part(m, 'hood'))
    expect(store.getState().avatar.equipped.accessory).toEqual([])
    expect(selectEquippedIds(store.getState())).toContain('ranger_arms')
    expect(selectEquippedCount(store.getState())).toBe(4)
    expect(selectCurrentPreset(m, store.getState())?.id).toBe('ranger')
  })

  it('混搭后 selectCurrentPreset 为 null', () => {
    const m = makeManifest()
    const store = createAvatarStore(m)
    store.getState().applyPreset(m.presets[0])
    store.getState().equip(part(m, 'peasant_legs'))
    expect(selectCurrentPreset(m, store.getState())).toBeNull()
  })

  it('setBase 返回被卸下的部件并切换 partsInActiveSlot 的过滤', () => {
    const m = makeManifest()
    const store = createAvatarStore(m)
    store.getState().equip(part(m, 'hair_f'))
    const removed = store.getState().setBase(m.bases[1])
    expect(removed.map((p) => p.id)).toEqual(['hair_f'])
    expect(selectBase(m, store.getState()).id).toBe('male_regular')
    expect(selectPartsInActiveSlot(m, store.getState()).map((p) => p.id)).toEqual(['hair_m'])
  })

  it('reset 回到初始；replace 整体替换', () => {
    const m = makeManifest()
    const store = createAvatarStore(m)
    store.getState().equip(part(m, 'ranger_body'))
    store.getState().reset()
    expect(selectEquippedCount(store.getState())).toBe(0)
    store.getState().replace({ baseId: 'male_regular', equipped: { hair: ['hair_m'] } })
    expect(store.getState().avatar.baseId).toBe('male_regular')
    expect(store.getState().avatar.equipped.hair).toEqual(['hair_m'])
  })
})
