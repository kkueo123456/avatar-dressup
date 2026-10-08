import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  get: async (k: string) => store.get(k),
  set: async (k: string, v: unknown) => { store.set(k, v) },
}))

import {
  MAX_SAVES, SavesFullError, addSave, deleteSave, fromSaveRecord, listSaves, toSaveRecord,
} from '@/data/saves'
import { createEmptyState, equipPart, setVariant } from '@/avatar/slotRules'
import { makeManifest, part } from './fixtures/manifest'

const m = makeManifest()

function dressed() {
  let s = createEmptyState(m, 'female_regular')
  s = equipPart(s, part(m, 'ranger_body'), m)
  s = equipPart(s, part(m, 'hair_f'), m)
  s = equipPart(s, part(m, 'hood'), m)
  s = equipPart(s, part(m, 'pauldron'), m)
  s = setVariant(s, 'ranger_body', 'b')
  return s
}

beforeEach(() => store.clear())

describe('listSaves / addSave / deleteSave', () => {
  it('初始为空', async () => {
    expect(await listSaves()).toEqual([])
  })

  it('新增后排在最前，删除后消失', async () => {
    const a = toSaveRecord(dressed(), 'A', 'data:a', 1, new Date('2026-10-08T00:00:00Z'))
    const b = toSaveRecord(dressed(), 'B', 'data:b', 1, new Date('2026-10-08T00:01:00Z'))
    await addSave(a)
    const list = await addSave(b)
    expect(list.map((r) => r.name)).toEqual(['B', 'A'])
    const after = await deleteSave(a.id)
    expect(after.map((r) => r.name)).toEqual(['B'])
  })

  it(`超过 ${MAX_SAVES} 条时抛 SavesFullError`, async () => {
    for (let i = 0; i < MAX_SAVES; i++) await addSave(toSaveRecord(dressed(), `S${i}`, '', 1))
    await expect(addSave(toSaveRecord(dressed(), 'overflow', '', 1))).rejects.toBeInstanceOf(SavesFullError)
  })
})

describe('toSaveRecord / fromSaveRecord', () => {
  it('往返后状态一致，包括多选槽位和变体', () => {
    const s = dressed()
    const rec = toSaveRecord(s, '我的游侠', 'data:x', 1, new Date('2026-10-08T00:00:00Z'))
    expect(rec.createdAt).toBe('2026-10-08T00:00:00.000Z')
    expect(rec.id).toMatch(/^[0-9a-f-]{36}$/)
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
    expect(state.variants.ranger_body).toBeUndefined()
    expect(state.equipped.arms).toEqual(['ranger_arms'])
  })

  it('底模不存在时退回第一个底模并报告', () => {
    const rec = { ...toSaveRecord(dressed(), 'x', '', 1), baseId: 'ghost' }
    const { state, skipped } = fromSaveRecord(rec, m)
    expect(state.baseId).toBe('female_regular')
    expect(skipped).toContain('ghost')
  })

  it('变体 id 已不存在时忽略该变体', () => {
    const rec = toSaveRecord(dressed(), 'x', '', 1)
    rec.variants.ranger_body = 'z'
    const { state } = fromSaveRecord(rec, m)
    expect(state.variants.ranger_body).toBeUndefined()
  })
})
