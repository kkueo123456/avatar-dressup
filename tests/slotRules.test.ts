import { describe, expect, it } from 'vitest'
import {
  applyPreset, changeBase, computeBodyVisible, createEmptyState, equipPart,
  partsForSlot, setVariant, unequipPart,
} from '@/avatar/slotRules'
import { makeManifest, part } from './fixtures/manifest'

const m = makeManifest()
const female = m.bases[0]
const male = m.bases[1]

describe('createEmptyState', () => {
  it('每个槽位都是空数组，底模身体可见', () => {
    const s = createEmptyState(m, female.id)
    expect(Object.keys(s.equipped).sort()).toEqual(m.slots.map((x) => x.id).sort())
    expect(Object.values(s.equipped).every((v) => v.length === 0)).toBe(true)
    expect(computeBodyVisible(s, m.slots)).toBe(true)
  })
})

describe('equipPart', () => {
  it('服装全空时装第一件会补全同套其余三件，并隐藏底模身体', () => {
    const s0 = createEmptyState(m, female.id)
    const s1 = equipPart(s0, part(m, 'ranger_body'), m)
    expect(s1.equipped.body).toEqual(['ranger_body'])
    expect(s1.equipped.arms).toEqual(['ranger_arms'])
    expect(s1.equipped.legs).toEqual(['ranger_legs'])
    expect(s1.equipped.feet).toEqual(['ranger_feet'])
    expect(computeBodyVisible(s1, m.slots)).toBe(false)
    expect(s0.equipped.body).toEqual([])
  })

  it('已穿服装时换一件只改该槽位', () => {
    const s1 = equipPart(createEmptyState(m, female.id), part(m, 'ranger_body'), m)
    const s2 = equipPart(s1, part(m, 'peasant_legs'), m)
    expect(s2.equipped.legs).toEqual(['peasant_legs'])
    expect(s2.equipped.body).toEqual(['ranger_body'])
    expect(s2.equipped.arms).toEqual(['ranger_arms'])
  })

  it('多选槽位累加且不重复', () => {
    let s = createEmptyState(m, female.id)
    s = equipPart(s, part(m, 'hood'), m)
    s = equipPart(s, part(m, 'pauldron'), m)
    s = equipPart(s, part(m, 'hood'), m)
    expect(s.equipped.accessory).toEqual(['hood', 'pauldron'])
    expect(computeBodyVisible(s, m.slots)).toBe(true)
  })

  it('没有 set 的服装不会触发补全', () => {
    const loose = { ...part(m, 'ranger_body'), id: 'loose_body', set: null }
    const mm = { ...m, parts: [...m.parts, loose] }
    const s = equipPart(createEmptyState(mm, female.id), loose, mm)
    expect(s.equipped.arms).toEqual([])
  })

  it('补全时跳过与底模性别不符的同套部件', () => {
    const mm = makeManifest()
    part(mm, 'ranger_arms').sex = 'male'
    const s = equipPart(createEmptyState(mm, female.id), part(mm, 'ranger_body'), mm)
    expect(s.equipped.arms).toEqual([])
    expect(s.equipped.legs).toEqual(['ranger_legs'])
  })
})

describe('unequipPart', () => {
  it('卸下单个部件并清掉它的变体', () => {
    let s = equipPart(createEmptyState(m, female.id), part(m, 'ranger_body'), m)
    s = setVariant(s, 'ranger_body', 'b')
    s = unequipPart(s, 'body')
    expect(s.equipped.body).toEqual([])
    expect(s.variants.ranger_body).toBeUndefined()
    expect(computeBodyVisible(s, m.slots)).toBe(false)
  })

  it('多选槽位只卸指定的一个', () => {
    let s = createEmptyState(m, female.id)
    s = equipPart(s, part(m, 'hood'), m)
    s = equipPart(s, part(m, 'pauldron'), m)
    s = unequipPart(s, 'accessory', 'hood')
    expect(s.equipped.accessory).toEqual(['pauldron'])
  })

  it('四个服装槽位全卸后底模身体重新可见', () => {
    let s = equipPart(createEmptyState(m, female.id), part(m, 'ranger_body'), m)
    for (const id of ['body', 'arms', 'legs', 'feet']) s = unequipPart(s, id)
    expect(computeBodyVisible(s, m.slots)).toBe(true)
  })
})

describe('applyPreset', () => {
  it('整套替换四个服装槽位，不动其他槽位', () => {
    let s = equipPart(createEmptyState(m, female.id), part(m, 'ranger_body'), m)
    s = equipPart(s, part(m, 'hair_f'), m)
    s = applyPreset(s, m.presets[1], m)
    expect(s.equipped.body).toEqual(['peasant_body'])
    expect(s.equipped.feet).toEqual(['peasant_feet'])
    expect(s.equipped.hair).toEqual(['hair_f'])
  })
})

describe('changeBase', () => {
  it('卸下性别不匹配的部件并返回它们，保留 any 部件', () => {
    let s = equipPart(createEmptyState(m, female.id), part(m, 'hair_f'), m)
    s = equipPart(s, part(m, 'ranger_body'), m)
    const r = changeBase(s, male, m)
    expect(r.state.baseId).toBe('male_regular')
    expect(r.state.equipped.hair).toEqual([])
    expect(r.state.equipped.body).toEqual(['ranger_body'])
    expect(r.removed.map((p) => p.id)).toEqual(['hair_f'])
  })
})

describe('partsForSlot', () => {
  it('按底模性别过滤', () => {
    expect(partsForSlot(m, 'hair', female).map((p) => p.id)).toEqual(['hair_f'])
    expect(partsForSlot(m, 'hair', male).map((p) => p.id)).toEqual(['hair_m'])
    expect(partsForSlot(m, 'body', male).map((p) => p.id)).toEqual(['ranger_body', 'peasant_body'])
  })
})
