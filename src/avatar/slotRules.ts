import type { BaseModel, Manifest, Part, Preset, Slot } from '@/types/manifest'

export interface AvatarState {
  baseId: string
  /** slotId -> partId[]；单选槽位数组长度为 0 或 1 */
  equipped: Record<string, string[]>
}

export function createEmptyState(manifest: Manifest, baseId: string): AvatarState {
  const equipped: Record<string, string[]> = {}
  for (const s of manifest.slots) equipped[s.id] = []
  return applyInitialParts({ baseId, equipped }, manifest)
}

/**
 * 给状态套上底模的初始装备：只填仍为空的槽位，已有部件不覆盖。
 * 拆分式底模（如 JustCreate）的裸模只是躯干，必须补上 base 系列四肢与
 * 脸/发型才呈现完整人体；整模底模（Quaternius fullbody）无 initialParts，行为不变。
 */
export function applyInitialParts(state: AvatarState, manifest: Manifest): AvatarState {
  const base = manifest.bases.find((b) => b.id === state.baseId)
  if (!base?.initialParts) return state
  const equipped = { ...state.equipped }
  let changed = false
  for (const [slotId, partId] of Object.entries(base.initialParts)) {
    if (equipped[slotId]?.length) continue
    const p = manifest.parts.find((x) => x.id === partId)
    if (!p || p.slot !== slotId || !partFitsBase(p, base)) continue
    equipped[slotId] = [partId]
    changed = true
  }
  return changed ? { ...state, equipped } : state
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

/** 槽位是否视为"裸"：空，或只装着底模的初始装部件（初始装是人体的组成部分，不算服装） */
function isBareSlot(equipped: Record<string, string[]>, base: BaseModel | undefined, slotId: string): boolean {
  const ids = equipped[slotId] ?? []
  if (!ids.length) return true
  const initId = base?.initialParts?.[slotId]
  return initId !== undefined && ids.length === 1 && ids[0] === initId
}

export function fillOutfitFromSet(state: AvatarState, part: Part, manifest: Manifest): AvatarState {
  if (!part.set) return state
  const base = baseOf(state, manifest)
  const equipped = { ...state.equipped }
  for (const slot of manifest.slots) {
    if (!slot.outfit || slot.id === part.slot) continue
    if (!isBareSlot(equipped, base, slot.id)) continue
    const match = manifest.parts.find(
      (p) => p.slot === slot.id && p.set === part.set && (!base || partFitsBase(p, base)),
    )
    if (match) equipped[slot.id] = [match.id]
  }
  return { ...state, equipped }
}

export function equipPart(state: AvatarState, part: Part, manifest: Manifest): AvatarState {
  const slot = slotOf(manifest, part.slot)
  const base = baseOf(state, manifest)
  // 初始装视为裸体：穿着初始装时穿第一件服装，仍触发整套补全（与整模底模行为一致）
  const wasOutfitEmpty = manifest.slots
    .filter((s) => s.outfit)
    .every((s) => isBareSlot(state.equipped, base, s.id))
  const current = state.equipped[slot.id] ?? []
  const nextList = slot.multiple
    ? current.includes(part.id) ? current : [...current, part.id]
    : [part.id]
  let next: AvatarState = { ...state, equipped: { ...state.equipped, [slot.id]: nextList } }
  if (slot.outfit && wasOutfitEmpty) next = fillOutfitFromSet(next, part, manifest)
  return next
}

/** 卸下部件；拆分式底模上槽位被卸空时自动穿回初始装（否则人物会缺肢体），整模底模行为不变 */
export function unequipPart(
  state: AvatarState,
  slotId: string,
  partId?: string,
  manifest?: Manifest,
): AvatarState {
  const current = state.equipped[slotId] ?? []
  const nextList = partId === undefined ? [] : current.filter((id) => id !== partId)
  if (nextList.length || !manifest) {
    return { ...state, equipped: { ...state.equipped, [slotId]: nextList } }
  }
  // 槽位空了：若该槽有初始装则穿回（applyInitialParts 只填空槽，天然幂等）
  const partially = { ...state, equipped: { ...state.equipped, [slotId]: [] } }
  return applyInitialParts(partially, manifest)
}

/**
 * 预设是否适配当前底模：预设引用的每个部件要么直接适配，
 * 要么能在同套装、同槽位找到适配底模的替代（与 applyPreset 的替换逻辑一致）。
 * 任一部件彻底无解则整套装置灰。
 */
export function presetFitsBase(
  manifest: Pick<Manifest, 'parts'>,
  preset: Preset,
  base: BaseModel | undefined,
): boolean {
  for (const partId of Object.values(preset.parts)) {
    const wanted = manifest.parts.find((x) => x.id === partId)
    if (!wanted) continue
    if (!base || partFitsBase(wanted, base)) continue
    const alt = manifest.parts.find(
      (x) => x.slot === wanted.slot && x.set === wanted.set && partFitsBase(x, base),
    )
    if (!alt) return false
  }
  return true
}

/** 能穿这套预设的所有底模（供置灰套装的"切换到哪些底模"提示用） */
export function basesFitByPreset(
  manifest: Manifest,
  preset: Preset,
): BaseModel[] {
  return manifest.bases.filter((b) => presetFitsBase(manifest, preset, b))
}

/**
 * body 槽是否穿着非初始的真服装：
 * - 拆分式底模（如 JustCreate）：躯干网格自带烘焙的初始衣物纹样，无法按区域摘除；
 *   实测其套装都自带完整内衬，body 槽穿上真服装时整体隐藏躯干即可消除叠穿穿帮。
 * - 整模底模（Quaternius fullbody）：初始衣物与身体一体建模（无法拆分），
 *   已通过脚本把 glb 拆成 SM_Body（含烘焙衣物）+ SM_Head（头/脖子）两个网格；
 *   但四肢皮肤与衣袖/裤腿也是一体，仅当四肢槽也被服装覆盖（如一键套装）
 *   才隐藏身体，手动只穿单件时保留身体避免缺肢体。
 */
export function shouldHideBaseBody(state: AvatarState, manifest: Manifest): boolean {
  const base = manifest.bases.find((b) => b.id === state.baseId)
  if (!base) return false
  if ((state.equipped.body ?? []).length === 0) return false
  if (base.initialParts) return true
  // 整模：四肢+脚都被覆盖才隐藏（套装场景），否则保留
  return (
    (state.equipped.arms ?? []).length > 0 &&
    (state.equipped.legs ?? []).length > 0 &&
    (state.equipped.feet ?? []).length > 0
  )
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
  // 预设未覆盖的服装槽（理论上少见）恢复初始装，保证拆分式底模肢体完整
  return applyInitialParts({ ...next, equipped }, manifest)
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
  // 新底模是拆分式（如 JustCreate）时，空槽位自动补初始装，保证人物完整
  return { state: applyInitialParts({ baseId: base.id, equipped }, manifest), removed }
}
