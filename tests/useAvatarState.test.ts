import { describe, expect, it } from 'vitest'
import { useAvatarState } from '@/state/useAvatarState'
import { makeManifest, part } from './fixtures/manifest'

describe('useAvatarState', () => {
  it('初始为第一个底模、全空、身体可见、第一个槽位激活', () => {
    const m = makeManifest()
    const s = useAvatarState(m)
    expect(s.state.avatar.baseId).toBe('female_regular')
    expect(s.bodyVisible.value).toBe(true)
    expect(s.state.activeSlot).toBe('hair')
    expect(s.partsInActiveSlot.value.map((p) => p.id)).toEqual(['hair_f'])
    expect(s.visibleSlots.value.map((x) => x.id)).toEqual(m.slots.map((x) => x.id).filter((id) => id !== 'eyebrows'))
  })

  it('没有部件的槽位不出现在 visibleSlots', () => {
    const m = makeManifest()
    m.parts = m.parts.filter((p) => p.slot !== 'eyebrows')
    const s = useAvatarState(m)
    expect(s.visibleSlots.value.map((x) => x.id)).not.toContain('eyebrows')
  })

  it('toggle：单选槽位重复点击保持，多选槽位重复点击卸下', () => {
    const m = makeManifest()
    const s = useAvatarState(m)
    s.toggle(part(m, 'ranger_body'))
    s.toggle(part(m, 'ranger_body'))
    expect(s.state.avatar.equipped.body).toEqual(['ranger_body'])
    expect(s.bodyVisible.value).toBe(false)
    s.toggle(part(m, 'hood'))
    s.toggle(part(m, 'hood'))
    expect(s.state.avatar.equipped.accessory).toEqual([])
    expect(s.equippedIds.value.has('ranger_arms')).toBe(true)
  })

  it('setBase 返回被卸下的部件并切换 partsInActiveSlot 的过滤', () => {
    const m = makeManifest()
    const s = useAvatarState(m)
    s.equip(part(m, 'hair_f'))
    const removed = s.setBase(m.bases[1])
    expect(removed.map((p) => p.id)).toEqual(['hair_f'])
    expect(s.base.value.id).toBe('male_regular')
    expect(s.partsInActiveSlot.value.map((p) => p.id)).toEqual(['hair_m'])
  })

  it('reset 回到初始；replace 整体替换', () => {
    const m = makeManifest()
    const s = useAvatarState(m)
    s.equip(part(m, 'ranger_body'))
    s.reset()
    expect(s.bodyVisible.value).toBe(true)
    s.replace({ baseId: 'male_regular', equipped: { hair: ['hair_m'] }, variants: {} })
    expect(s.state.avatar.baseId).toBe('male_regular')
    expect(s.state.avatar.equipped.hair).toEqual(['hair_m'])
  })
})
