import type { AnimationRef, BaseModel, Manifest, Part } from '@/types/manifest'
import type { AvatarState } from '@/avatar/slotRules'
import type { AvatarStore } from './avatarStore'

export interface ViewerLike {
  setBase(base: BaseModel): Promise<void>
  equip(part: Part): Promise<void>
  unequip(partId: string): void
  playAnimation(anim: AnimationRef): Promise<void>
  focus?(target: 'body' | 'head'): void
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

/**
 * 监听 store 里 avatar 的变化，把差分推给 viewer。
 * 所有动作串进一个队列；某件部件装备失败时从 store 里卸掉它，保持界面与 3D 一致。
 */
export function createViewerSync(
  store: AvatarStore,
  viewer: ViewerLike,
  manifest: Manifest,
  onError: (id: string, err: unknown) => void,
): ViewerSync {
  let queue: Promise<void> = Promise.resolve()
  const idleAnim: AnimationRef | undefined = manifest.animations[0]
  const partOf = (id: string) => manifest.parts.find((p) => p.id === id)

  async function equipAll(ids: string[]): Promise<void> {
    for (const id of ids) {
      const part = partOf(id)
      if (!part) continue
      try {
        await viewer.equip(part)
      } catch (e) {
        onError(id, e)
        store.getState().unequip(part.slot, id)
      }
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
      await equipAll(Object.values(next.equipped).flat())
      // 动画与初始装全部就位后再取景：此时模型才是完整形态。
      // setBase 内部的聚焦只看得到裸躯干（拆分式底模），机位会凑太近、构图错误。
      viewer.focus?.('body')
      return
    }
    const { added, removed } = diffEquipped(prev.equipped, next.equipped)
    for (const id of removed) viewer.unequip(id)
    await equipAll(added)
  }

  function enqueue(next: AvatarState, prev: AvatarState | undefined): void {
    queue = queue
      .then(() => applyInner(next, prev))
      .catch((e: unknown) => onError('sync', e))
  }

  enqueue(store.getState().avatar, undefined)
  const unsubscribe = store.subscribe((s, prevState) => {
    if (s.avatar === prevState.avatar) return
    enqueue(s.avatar, prevState.avatar)
  })

  async function idle(): Promise<void> {
    let last: Promise<void>
    do {
      await new Promise<void>((r) => setTimeout(r, 0))
      last = queue
      await last
    } while (last !== queue)
  }

  return { stop: unsubscribe, idle }
}
