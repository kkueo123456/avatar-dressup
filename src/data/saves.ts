import { get, set } from 'idb-keyval'
import type { Manifest } from '@/types/manifest'
import type { SaveRecord } from '@/types/save'
import { createEmptyState, type AvatarState } from '@/avatar/slotRules'

export const SAVES_KEY = 'saves'
export const MAX_SAVES = 50

export class SavesFullError extends Error {
  constructor() {
    super(`最多保存 ${MAX_SAVES} 个形象，请先删除一些`)
    this.name = 'SavesFullError'
  }
}

export async function listSaves(): Promise<SaveRecord[]> {
  const list = await get<SaveRecord[]>(SAVES_KEY)
  return Array.isArray(list) ? list : []
}

export async function addSave(record: SaveRecord): Promise<SaveRecord[]> {
  const list = await listSaves()
  if (list.length >= MAX_SAVES) throw new SavesFullError()
  const next = [record, ...list]
  await set(SAVES_KEY, next)
  return next
}

export async function deleteSave(id: string): Promise<SaveRecord[]> {
  const next = (await listSaves()).filter((r) => r.id !== id)
  await set(SAVES_KEY, next)
  return next
}

export function toSaveRecord(
  state: AvatarState,
  name: string,
  thumbnail: string,
  manifestVersion: number,
  now: Date = new Date(),
): SaveRecord {
  return {
    id: crypto.randomUUID(),
    name,
    createdAt: now.toISOString(),
    manifestVersion,
    baseId: state.baseId,
    parts: Object.fromEntries(Object.entries(state.equipped).map(([k, v]) => [k, [...v]])),
    variants: { ...state.variants },
    thumbnail,
  }
}

export function fromSaveRecord(
  record: SaveRecord,
  manifest: Manifest,
): { state: AvatarState; skipped: string[] } {
  const skipped: string[] = []
  const base = manifest.bases.find((b) => b.id === record.baseId) ?? manifest.bases[0]
  if (base.id !== record.baseId) skipped.push(record.baseId)
  const state = createEmptyState(manifest, base.id)
  for (const [slotId, ids] of Object.entries(record.parts)) {
    const target = state.equipped[slotId]
    if (!target) {
      skipped.push(...ids)
      continue
    }
    for (const id of ids) {
      const p = manifest.parts.find((x) => x.id === id && x.slot === slotId)
      if (p) target.push(id)
      else skipped.push(id)
    }
  }
  const equippedIds = new Set(Object.values(state.equipped).flat())
  for (const [partId, variantId] of Object.entries(record.variants)) {
    const p = manifest.parts.find((x) => x.id === partId)
    if (p && equippedIds.has(partId) && p.variants.some((v) => v.id === variantId)) {
      state.variants[partId] = variantId
    }
  }
  return { state, skipped }
}
