'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Manifest } from '@/types/manifest'
import { loadManifest } from '@/data/manifest'
import { assetUrl } from '@/data/assetUrl'
import { createAvatarStore, type AvatarStore } from '@/state/avatarStore'
import { createViewerSync } from '@/state/viewerSync'
import { clearError, updateLoading } from '@/state/loadState'
import { AvatarViewer } from '@/avatar/AvatarViewer'
import { ThumbnailRenderer } from '@/avatar/ThumbnailRenderer'
import { DressUpContext } from './DressUpContext'
import PartsPanel from './PartsPanel'
import PosterDialog from './PosterDialog'
import SaveDialog from './SaveDialog'
import TopBar from './TopBar'
import Viewport from './Viewport'
import styles from './dressup.module.css'

type Phase =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; manifest: Manifest; store: AvatarStore }

const GROUND = '#0F0E14'

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export default function DressUp({ avatarId }: { avatarId?: string }) {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>({ status: 'loading' })
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [viewer, setViewer] = useState<AvatarViewer | null>(null)
  const [thumbs, setThumbs] = useState<ThumbnailRenderer | null>(null)
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(() => new Set())
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [posterOpen, setPosterOpen] = useState(false)
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [savedAvatarId, setSavedAvatarId] = useState<string | null>(null)
  const [avatarName, setAvatarName] = useState<string | null>(null)

  // 读 manifest，校验失败整页报错；如有 avatarId 同时加载历史形象
  useEffect(() => {
    let cancelled = false
    loadManifest()
      .then(async (manifest) => {
        if (cancelled) return
        const store = createAvatarStore(manifest)

        if (avatarId) {
          try {
            const res = await fetch(`/api/avatar/${avatarId}`, { credentials: 'include' })
            if (!res.ok) {
              const data = (await res.json()) as { error?: string }
              throw new Error(data.error || '加载形象失败')
            }
            const data = (await res.json()) as { name?: string; baseId: string; parts: Record<string, string[]> }
            store.getState().replace({
              baseId: data.baseId,
              equipped: data.parts,
            })
            if (!cancelled) setAvatarName(data.name ?? null)
          } catch (e) {
            if (!cancelled) setRestoreError(reasonOf(e))
          }
        }

        if (!cancelled) setPhase({ status: 'ready', manifest, store })
      })
      .catch((e: unknown) => {
        if (!cancelled) setPhase({ status: 'error', message: reasonOf(e) })
      })
    return () => {
      cancelled = true
    }
  }, [avatarId])

  // manifest 就绪且容器挂上后建 3D；严格模式会执行两遍，清理函数必须把一切释放干净
  useEffect(() => {
    if (phase.status !== 'ready' || !containerRef.current) return
    const { manifest, store } = phase
    let v: AvatarViewer
    try {
      v = new AvatarViewer(containerRef.current, assetUrl, { background: GROUND })
    } catch (e) {
      setPhase({ status: 'error', message: `无法创建 3D 视口，浏览器可能不支持 WebGL。${reasonOf(e)}` })
      return
    }
    v.on('loading', (stage, id) => {
      setLoadingIds((prev) => updateLoading(prev, stage, id))
      // 重新开始加载就清掉上次的错误，一次网络抖动不该让这件部件整个会话都置灰
      if (stage === 'start') setErrors((prev) => clearError(prev, id))
    })
    const sync = createViewerSync(store, v, manifest, (id, err) => {
      setErrors((prev) => new Map(prev).set(id, reasonOf(err)))
    })
    const t = new ThumbnailRenderer(v.loader, assetUrl)
    setViewer(v)
    setThumbs(t)
    // 开发期在控制台里能拿到视口对象排查 3D 问题；生产构建里这段会被去掉
    if (process.env.NODE_ENV === 'development') (window as unknown as { __viewer?: AvatarViewer }).__viewer = v
    return () => {
      sync.stop()
      t.dispose()
      v.dispose()
      setViewer(null)
      setThumbs(null)
      setLoadingIds(new Set())
      setErrors(new Map())
    }
  }, [phase])

  if (phase.status === 'loading') {
    return (
      <div className={styles.layout}>
        <TopBar />
        <div className={styles.overlay}>正在读取部件清单…</div>
      </div>
    )
  }
  if (phase.status === 'error') {
    return (
      <div className={styles.layout}>
        <TopBar />
        <div className={`${styles.overlay} ${styles.overlayError}`} role="alert">{phase.message}</div>
      </div>
    )
  }

  // 底模还在加载时截出来的是空场景，先别让「保存」可点；部件加载不影响（顶多少一件衣服）
  const baseLoading = phase.manifest.bases.some((b) => loadingIds.has(b.id))

  async function handleSave(name: string, withPoster: boolean) {
    if (!viewer) throw new Error('3D 视口未就绪')
    setSaveLoading(true)
    try {
      const coverUrl = viewer.screenshot()
      const state = phase.status === 'ready' ? phase.store.getState() : null
      if (!state) throw new Error('形象状态未就绪')

      // 编辑已有形象 → PATCH 更新；新形象 → POST 创建（避免编辑后保存产生重复形象）
      const isEditing = !!avatarId
      const res = await fetch(isEditing ? `/api/avatar/${avatarId}` : '/api/avatar', {
        method: isEditing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(
          isEditing
            ? { name, parts: state.avatar.equipped, coverUrl }
            : { name, baseId: state.avatar.baseId, parts: state.avatar.equipped, coverUrl },
        ),
      })
      const data = (await res.json()) as { id?: string; error?: string }
      if (!res.ok) {
        throw new Error(data.error || `保存失败（${res.status}）`)
      }
      setSavedAvatarId(data.id || avatarId || null)
      setAvatarName(name)
      setSaveOpen(false)
      if (withPoster && (data.id || avatarId)) {
        setPosterOpen(true) // 保存并生成海报：等海报流程走完再跳转
      } else {
        router.push('/avatars') // 仅保存：直接进入我的形象库
      }
    } finally {
      setSaveLoading(false)
    }
  }

  async function handlePosterDone(posterUrl: string) {
    if (!savedAvatarId) return
    try {
      await fetch(`/api/avatar/${savedAvatarId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ posterUrl }),
      })
    } catch (e) {
      // 回写失败不阻塞流程，形象本体已保存
      console.error('海报地址回写失败:', e)
    }
    setSavedAvatarId(null)
    router.push('/avatars') // 海报完成，进入我的形象库
  }

  return (
    <DressUpContext.Provider value={{ manifest: phase.manifest, store: phase.store, viewer, thumbs, loadingIds, errors }}>
      <div className={styles.layout}>
        <TopBar onSave={viewer && !baseLoading ? () => setSaveOpen(true) : undefined} />
        {restoreError && (
          <div className={styles.restoreWarn} role="alert">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            形象恢复失败：{restoreError}
          </div>
        )}
        <div className={styles.main}>
          <Viewport containerRef={containerRef} />
          <PartsPanel />
        </div>
        <SaveDialog
          open={saveOpen}
          onClose={() => setSaveOpen(false)}
          onSave={handleSave}
          isLoading={saveLoading}
          initialName={avatarName ?? undefined}
        />
        {viewer && (
          <PosterDialog
            open={posterOpen}
            onClose={() => setPosterOpen(false)}
            screenshot={() => viewer.screenshot()}
            onDone={handlePosterDone}
            avatarId={savedAvatarId ?? avatarId}
          />
        )}
      </div>
    </DressUpContext.Provider>
  )
}
