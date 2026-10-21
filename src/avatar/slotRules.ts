import type { BaseModel, Manifest, Part, Preset, Slot } from '@/types/manifest'

export interface AvatarState {
  baseId: string
  /** slotId -> partId[]；单选槽位数组长度为 0 或 1 */
  equipped: Record<string, string[]>
}

export function createEmptyState(manifest: Manifest, baseId: string): AvatarState {
  const equipped: Record<string, string[]> = {}
  for (const s of manifest.slots) equipped[s.id] = []
  return { baseId, equipped }
}

export function partFitsBase(part: Part, base: BaseModel): boolean {
  // 骨架体系必须一致（缺省视为 quaternius，兼容旧 manifest）
  if ((part.rig ?? 'quaternius') !== (base.rig ?? 'quaternius')) return false
  return part.sex === 'any' || part.sex === base.sex
}

export function partsForSlot(manifest: Manifest, slotId: string, base: BaseModel): Part[] {
  return manifest.parts.filter((p) => p.slot === slotId && partFitsBase(p, base))
}

export function isOutfitEmpty(state: AvatarState, slots: Slot[]): boolean {
  return slots.filter((s) => s.outfit).every((s) => (state.equipped[s.id] ?? []).length === 0)
}

function slotOf(manifest: Manifest, slotId: string): Slot {
  const slot = manifest.slots.find((s) => s.id === slotId)
  if (!slot) throw new Error(`未知槽位 ${slotId}`)
  return slot
}

function baseOf(state: AvatarState, manifest: Manifest): BaseModel | undefined {
  return manifest.bases.find((b) => b.id === state.baseId)
}

export function fillOutfitFromSet(state: AvatarState, part: Part, manifest: Manifest): AvatarState {
  if (!part.set) return state
  const base = baseOf(state, manifest)
  const equipped = { ...state.equipped }
  for (const slot of manifest.slots) {
    if (!slot.outfit || slot.id === part.slot) continue
    if ((equipped[slot.id] ?? []).length) continue
    const match = manifest.parts.find(
      (p) => p.slot === slot.id && p.set === part.set && (!base || partFitsBase(p, base)),
    )
    if (match) equipped[slot.id] = [match.id]
  }
  return { ...state, equipped }
}

export function equipPart(state: AvatarState, part: Part, manifest: Manifest): AvatarState {
  const slot = slotOf(manifest, part.slot)
  const wasOutfitEmpty = isOutfitEmpty(state, manifest.slots)
  const current = state.equipped[slot.id] ?? []
  const nextList = slot.multiple
    ? current.includes(part.id) ? current : [...current, part.id]
    : [part.id]
  let next: AvatarState = { ...state, equipped: { ...state.equipped, [slot.id]: nextList } }
  if (slot.outfit && wasOutfitEmpty) next = fillOutfitFromSet(next, part, manifest)
  return next
}

export function unequipPart(state: AvatarState, slotId: string, partId?: string): AvatarState {
  const current = state.equipped[slotId] ?? []
  const nextList = partId === undefined ? [] : current.filter((id) => id !== partId)
  return { ...state, equipped: { ...state.equipped, [slotId]: nextList } }
}

/**
 * 整套替换四个服装槽位。预设里记录的是某一性别的部件 id；
 * 若该部件不匹配当前底模，就换成同套、同槽位、匹配底模的那件（资源脚本保证男女各有一套）。
 */
export function applyPreset(state: AvatarState, preset: Preset, manifest: Manifest): AvatarState {
  let next = state
  for (const slot of manifest.slots) if (slot.outfit) next = unequipPart(next, slot.id)
  const base = baseOf(next, manifest)
  const equipped = { ...next.equipped }
  for (const [slotId, partId] of Object.entries(preset.parts)) {
    const wanted = manifest.parts.find((x) => x.id === partId)
    if (!wanted || wanted.slot !== slotId) continue
    const p = !base || partFitsBase(wanted, base)
      ? wanted
      : manifest.parts.find((x) => x.slot === slotId && x.set === wanted.set && partFitsBase(x, base))
    if (p) equipped[slotId] = [p.id]
  }
  return { ...next, equipped }
}

export function changeBase(
  state: AvatarState,
  base: BaseModel,
  manifest: Manifest,
): { state: AvatarState; removed: Part[] } {
  const removed: Part[] = []
  const equipped: Record<string, string[]> = {}
  for (const [slotId, ids] of Object.entries(state.equipped)) {
    equipped[slotId] = ids.filter((id) => {
      const p = manifest.parts.find((x) => x.id === id)
      if (!p) return false
      if (partFitsBase(p, base)) return true
      removed.push(p)
      return false
    })
  }
  return { state: { baseId: base.id, equipped }, removed }
}
