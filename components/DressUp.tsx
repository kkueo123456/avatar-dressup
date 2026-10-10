'use client'
import { useEffect, useRef, useState } from 'react'
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

export default function DressUp() {
  const [phase, setPhase] = useState<Phase>({ status: 'loading' })
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [viewer, setViewer] = useState<AvatarViewer | null>(null)
  const [thumbs, setThumbs] = useState<ThumbnailRenderer | null>(null)
  const [loadingIds, setLoadingIds] = useState<ReadonlySet<string>>(() => new Set())
  const [errors, setErrors] = useState<ReadonlyMap<string, string>>(() => new Map())
  const [posterOpen, setPosterOpen] = useState(false)

  // 读 manifest，校验失败整页报错
  useEffect(() => {
    let cancelled = false
    loadManifest()
      .then((manifest) => {
        if (!cancelled) setPhase({ status: 'ready', manifest, store: createAvatarStore(manifest) })
      })
      .catch((e: unknown) => {
        if (!cancelled) setPhase({ status: 'error', message: reasonOf(e) })
      })
    return () => {
      cancelled = true
    }
  }, [])

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

  return (
    <DressUpContext.Provider value={{ manifest: phase.manifest, store: phase.store, viewer, thumbs, loadingIds, errors }}>
      <div className={styles.layout}>
        <TopBar onPoster={viewer ? () => setPosterOpen(true) : undefined} />
        <div className={styles.main}>
          <Viewport containerRef={containerRef} />
          <PartsPanel />
        </div>
        {viewer && (
          <PosterDialog open={posterOpen} onClose={() => setPosterOpen(false)} screenshot={() => viewer.screenshot()} />
        )}
      </div>
    </DressUpContext.Provider>
  )
}
