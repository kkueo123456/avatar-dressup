'use client'
import { createContext, useContext } from 'react'
import type { Manifest } from '@/types/manifest'
import type { AvatarStore } from '@/state/avatarStore'
import type { AvatarViewer } from '@/avatar/AvatarViewer'
import type { ThumbnailRenderer } from '@/avatar/ThumbnailRenderer'

export interface DressUpServices {
  manifest: Manifest
  store: AvatarStore
  /** 视口挂好之前为 null */
  viewer: AvatarViewer | null
  thumbs: ThumbnailRenderer | null
  /** 正在加载的部件或底模 id */
  loadingIds: ReadonlySet<string>
  /** 加载或绑定失败的部件或底模 id 到原因 */
  errors: ReadonlyMap<string, string>
}

export const DressUpContext = createContext<DressUpServices | null>(null)

export function useDressUp(): DressUpServices {
  const v = useContext(DressUpContext)
  if (!v) throw new Error('useDressUp 必须在 DressUp 内部使用')
  return v
}
