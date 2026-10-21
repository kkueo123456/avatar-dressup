import type { Manifest } from '@/types/manifest'
import type { SaveRecord } from '@/types/save'
import { createEmptyState, type AvatarState } from '@/avatar/slotRules'

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
    thumbnail,
  }
}

/** 恢复时若部件、槽位或底模已不在 manifest 中，跳过并在 skipped 里报告，不整体失败 */
export function fromSaveRecord(
  record: SaveRecord,
  manifest: Manifest,
): { state: AvatarState; skipped: string[] } {
  const skipped: string[] = []
  const base = manifest.bases.find((b) => b.id === record.baseId)
    ?? manifest.bases.find((b) => b.sex === 'male')
    ?? manifest.bases[0]
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
  return { state, skipped }
}
