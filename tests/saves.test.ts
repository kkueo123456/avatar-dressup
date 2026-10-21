import { describe, expect, it } from 'vitest'
import { fromSaveRecord, toSaveRecord } from '@/data/saves'
import { createEmptyState, equipPart } from '@/avatar/slotRules'
import { makeManifest, part } from './fixtures/manifest'

const m = makeManifest()

function dressed() {
  let s = createEmptyState(m, 'female_regular')
  s = equipPart(s, part(m, 'ranger_body'), m)
  s = equipPart(s, part(m, 'hair_f'), m)
  s = equipPart(s, part(m, 'hood'), m)
  s = equipPart(s, part(m, 'pauldron'), m)
  return s
}

describe('toSaveRecord / fromSaveRecord', () => {
  it('往返后状态一致，包括多选槽位', () => {
    const s = dressed()
    const rec = toSaveRecord(s, '我的游侠', 'data:x', 1, new Date('2026-10-08T00:00:00Z'))
    expect(rec.createdAt).toBe('2026-10-08T00:00:00.000Z')
    expect(rec.id).toMatch(/^[0-9a-f-]{36}$/)
    expect('variants' in rec).toBe(false)
    const { state, skipped } = fromSaveRecord(rec, m)
    expect(skipped).toEqual([])
    expect(state).toEqual(s)
  })

  it('记录里的部件已不存在时跳过并报告', () => {
    const rec = toSaveRecord(dressed(), 'old', '', 1)
    const mm = makeManifest()
    mm.parts = mm.parts.filter((p) => p.id !== 'ranger_body' && p.id !== 'hood')
    const { state, skipped } = fromSaveRecord(rec, mm)
    expect(skipped.sort()).toEqual(['hood', 'ranger_body'])
    expect(state.equipped.body).toEqual([])
    expect(state.equipped.accessory).toEqual(['pauldron'])
    expect(state.equipped.arms).toEqual(['ranger_arms'])
  })

  it('记录里的槽位已不存在时跳过该槽位的全部部件', () => {
    const rec = toSaveRecord(dressed(), 'old', '', 1)
    const mm = makeManifest()
    mm.slots = mm.slots.filter((s) => s.id !== 'accessory')
    const { state, skipped } = fromSaveRecord(rec, mm)
    expect(skipped.sort()).toEqual(['hood', 'pauldron'])
    expect('accessory' in state.equipped).toBe(false)
  })

  it('底模不存在时退回默认底模（男性优先）并报告', () => {
    const rec = { ...toSaveRecord(dressed(), 'x', '', 1), baseId: 'ghost' }
    const { state, skipped } = fromSaveRecord(rec, m)
    expect(state.baseId).toBe('male_regular')
    expect(skipped).toContain('ghost')
  })
})
