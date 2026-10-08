import { nextTick, watch } from 'vue'
import type { AnimationRef, BaseModel, Manifest, Part, Variant } from '@/types/manifest'
import { computeBodyVisible, type AvatarState } from '@/avatar/slotRules'
import type { AvatarStore } from './useAvatarState'

export interface ViewerLike {
  setBase(base: BaseModel): Promise<void>
  equip(part: Part): Promise<void>
  unequip(partId: string): void
  setBodyVisible(visible: boolean): void
  setVariant(part: Part, variant: Variant | null): Promise<void>
  playAnimation(anim: AnimationRef): Promise<void>
}

export function diffEquipped(
  prev: Record<string, string[]>,
  next: Record<string, string[]>,
): { added: string[]; removed: string[] } {
  const p = new Set(Object.values(prev).flat())
  const n = new Set(Object.values(next).flat())
  return {
    added: [...n].filter((id) => !p.has(id)),
    removed: [...p].filter((id) => !n.has(id)),
  }
}

export interface ViewerSync {
  stop(): void
  /** 等到所有排队的同步动作都完成 */
  idle(): Promise<void>
}

export function createViewerSync(
  store: AvatarStore,
  viewer: ViewerLike,
  manifest: Manifest,
  onError: (id: string, err: unknown) => void,
): ViewerSync {
  let queue: Promise<void> = Promise.resolve()
  const idleAnim: AnimationRef | undefined = manifest.animations[0]
  const partOf = (id: string) => manifest.parts.find((p) => p.id === id)

  async function applyVariant(part: Part, variantId: string | undefined): Promise<void> {
    const variant = variantId ? (part.variants.find((v) => v.id === variantId) ?? null) : null
    await viewer.setVariant(part, variant).catch((e: unknown) => onError(part.id, e))
  }

  async function equipAll(ids: string[], state: AvatarState): Promise<void> {
    for (const id of ids) {
      const part = partOf(id)
      if (!part) continue
      try {
        await viewer.equip(part)
      } catch (e) {
        onError(id, e)
        store.unequip(part.slot, id)
        continue
      }
      if (state.variants[id]) await applyVariant(part, state.variants[id])
    }
  }

  async function applyInner(next: AvatarState, prev: AvatarState | undefined): Promise<void> {
    if (!prev || prev.baseId !== next.baseId) {
      const base = manifest.bases.find((b) => b.id === next.baseId)
      if (!base) return
      try {
        await viewer.setBase(base)
      } catch (e) {
        onError(base.id, e)
        return
      }
      if (idleAnim) await viewer.playAnimation(idleAnim).catch((e: unknown) => onError(idleAnim.id, e))
      await equipAll(Object.values(next.equipped).flat(), next)
    } else {
      const { added, removed } = diffEquipped(prev.equipped, next.equipped)
      for (const id of removed) viewer.unequip(id)
      await equipAll(added, next)
      for (const [id, variantId] of Object.entries(next.variants)) {
        if (added.includes(id) || prev.variants[id] === variantId) continue
        const part = partOf(id)
        if (part) await applyVariant(part, variantId)
      }
      for (const id of Object.keys(prev.variants)) {
        if (id in next.variants || removed.includes(id)) continue
        const part = partOf(id)
        if (part) await applyVariant(part, undefined)
      }
    }
    viewer.setBodyVisible(computeBodyVisible(next, manifest.slots))
  }

  async function apply(next: AvatarState, prev: AvatarState | undefined): Promise<void> {
    try {
      await applyInner(next, prev)
    } catch (e) {
      onError('sync', e)
    }
  }

  const stop = watch(
    () => store.state.avatar,
    (next, prev) => {
      queue = queue.then(() => apply(next, prev)).catch(() => undefined)
    },
    { immediate: true },
  )

  async function idle(): Promise<void> {
    let last: Promise<void>
    do {
      await nextTick()
      last = queue
      await last
    } while (last !== queue)
  }

  return { stop, idle }
}
