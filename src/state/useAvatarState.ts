import { computed, reactive } from 'vue'
import type { BaseModel, Manifest, Part, Preset, Slot } from '@/types/manifest'
import * as rules from '@/avatar/slotRules'
import type { AvatarState } from '@/avatar/slotRules'

export function useAvatarState(manifest: Manifest) {
  const state = reactive<{ avatar: AvatarState; activeSlot: string }>({
    avatar: rules.createEmptyState(manifest, manifest.bases[0].id),
    activeSlot: manifest.slots[0]?.id ?? '',
  })

  const base = computed<BaseModel>(
    () => manifest.bases.find((b) => b.id === state.avatar.baseId) ?? manifest.bases[0],
  )
  const bodyVisible = computed(() => rules.computeBodyVisible(state.avatar, manifest.slots))
  const visibleSlots = computed<Slot[]>(() =>
    manifest.slots.filter((s) => rules.partsForSlot(manifest, s.id, base.value).length > 0),
  )
  const activeSlotDef = computed<Slot | undefined>(() => manifest.slots.find((s) => s.id === state.activeSlot))
  const partsInActiveSlot = computed<Part[]>(() => rules.partsForSlot(manifest, state.activeSlot, base.value))
  const equippedIds = computed(() => new Set(Object.values(state.avatar.equipped).flat()))

  const partById = (id: string): Part | undefined => manifest.parts.find((p) => p.id === id)

  function equip(part: Part): void {
    state.avatar = rules.equipPart(state.avatar, part, manifest)
  }
  function unequip(slotId: string, partId?: string): void {
    state.avatar = rules.unequipPart(state.avatar, slotId, partId)
  }
  function toggle(part: Part): void {
    const slot = manifest.slots.find((s) => s.id === part.slot)
    const current = state.avatar.equipped[part.slot] ?? []
    if (current.includes(part.id)) {
      if (slot?.multiple) unequip(part.slot, part.id)
      return
    }
    equip(part)
  }
  function applyPreset(preset: Preset): void {
    state.avatar = rules.applyPreset(state.avatar, preset, manifest)
  }
  function setVariant(partId: string, variantId: string): void {
    state.avatar = rules.setVariant(state.avatar, partId, variantId)
  }
  function setBase(b: BaseModel): Part[] {
    const r = rules.changeBase(state.avatar, b, manifest)
    state.avatar = r.state
    return r.removed
  }
  function reset(): void {
    state.avatar = rules.createEmptyState(manifest, manifest.bases[0].id)
  }
  function replace(next: AvatarState): void {
    state.avatar = next
  }
  function setActiveSlot(id: string): void {
    state.activeSlot = id
  }

  return {
    state, manifest, base, bodyVisible, visibleSlots, activeSlotDef, partsInActiveSlot, equippedIds,
    partById, equip, unequip, toggle, applyPreset, setVariant, setBase, reset, replace, setActiveSlot,
  }
}

export type AvatarStore = ReturnType<typeof useAvatarState>
