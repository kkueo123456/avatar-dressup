import { createStore, type StoreApi } from 'zustand/vanilla'
import type { BaseModel, Manifest, Part, Preset, Slot } from '@/types/manifest'
import * as rules from '@/avatar/slotRules'
import type { AvatarState } from '@/avatar/slotRules'

export interface AvatarStoreState {
  avatar: AvatarState
  activeSlot: string
  equip(part: Part): void
  unequip(slotId: string, partId?: string): void
  toggle(part: Part): void
  applyPreset(preset: Preset): void
  /** 返回因性别不匹配被卸下的部件，供界面提示 */
  setBase(base: BaseModel): Part[]
  reset(): void
  replace(next: AvatarState): void
  setActiveSlot(id: string): void
}

export type AvatarStore = StoreApi<AvatarStoreState>

/** 默认底模：优先男性（用户习惯），没有男性底模时退回第一个 */
export function selectDefaultBase(manifest: Manifest): BaseModel {
  return manifest.bases.find((b) => b.sex === 'male') ?? manifest.bases[0]
}

export function createAvatarStore(manifest: Manifest): AvatarStore {
  return createStore<AvatarStoreState>()((set, get) => ({
    avatar: rules.createEmptyState(manifest, selectDefaultBase(manifest).id),
    activeSlot: manifest.slots[0]?.id ?? '',
    equip(part) {
      set({ avatar: rules.equipPart(get().avatar, part, manifest) })
    },
    unequip(slotId, partId) {
      set({ avatar: rules.unequipPart(get().avatar, slotId, partId) })
    },
    toggle(part) {
      const slot = manifest.slots.find((s) => s.id === part.slot)
      const current = get().avatar.equipped[part.slot] ?? []
      if (current.includes(part.id)) {
        if (slot?.multiple) get().unequip(part.slot, part.id)
        return
      }
      get().equip(part)
    },
    applyPreset(preset) {
      set({ avatar: rules.applyPreset(get().avatar, preset, manifest) })
    },
    setBase(base) {
      const r = rules.changeBase(get().avatar, base, manifest)
      set({ avatar: r.state })
      return r.removed
    },
    reset() {
      set({ avatar: rules.createEmptyState(manifest, selectDefaultBase(manifest).id) })
    },
    replace(next) {
      set({ avatar: next })
    },
    setActiveSlot(id) {
      set({ activeSlot: id })
    },
  }))
}

// ---- selector：接收 store 状态的纯函数，组件里配合 useStore 使用 ----

export function selectBase(manifest: Manifest, s: AvatarStoreState): BaseModel {
  return manifest.bases.find((b) => b.id === s.avatar.baseId) ?? selectDefaultBase(manifest)
}

export function selectVisibleSlots(manifest: Manifest, s: AvatarStoreState): Slot[] {
  const base = selectBase(manifest, s)
  return manifest.slots.filter((slot) => rules.partsForSlot(manifest, slot.id, base).length > 0)
}

export function selectPartsInActiveSlot(manifest: Manifest, s: AvatarStoreState): Part[] {
  return rules.partsForSlot(manifest, s.activeSlot, selectBase(manifest, s))
}

export function selectEquippedIds(s: AvatarStoreState): string[] {
  return Object.values(s.avatar.equipped).flat()
}

export function selectEquippedCount(s: AvatarStoreState): number {
  return selectEquippedIds(s).length
}

/**
 * 预设覆盖的每个槽位上装的都是该套装的部件时返回它，否则 null。
 * 按套装名比对而不是按部件 id，因为男女底模各有一套同名部件；资源脚本保证预设 id 等于套装名。
 */
export function selectCurrentPreset(manifest: Manifest, s: AvatarStoreState): Preset | null {
  for (const preset of manifest.presets) {
    const hit = Object.keys(preset.parts).every((slotId) => {
      const id = (s.avatar.equipped[slotId] ?? [])[0]
      const p = id ? manifest.parts.find((x) => x.id === id) : undefined
      return p?.set === preset.id
    })
    if (hit) return preset
  }
  return null
}
