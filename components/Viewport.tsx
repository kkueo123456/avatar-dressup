'use client'
import { useEffect, useState, type RefObject } from 'react'
import { useStore } from 'zustand'
import { selectBase } from '@/state/avatarStore'
import { useDressUp } from './DressUpContext'
import styles from './dressup.module.css'

type Focus = 'body' | 'head'

export default function Viewport({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const { manifest, store, viewer, loadingIds, errors } = useDressUp()
  const base = useStore(store, (s) => selectBase(manifest, s))
  const [focus, setFocus] = useState<Focus>('body')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(t)
  }, [toast])

  const baseError = manifest.bases.map((b) => errors.get(b.id)).find(Boolean)
  const busy = loadingIds.size > 0
  const animLabel = manifest.animations[0]?.label ?? '无'

  function changeBase(id: string) {
    const next = manifest.bases.find((b) => b.id === id)
    if (!next || next.id === base.id) return
    const removed = store.getState().setBase(next)
    if (removed.length) setToast(`已卸下 ${removed.length} 件不匹配的部件：${removed.map((p) => p.label).join('、')}`)
  }

  function changeFocus(f: Focus) {
    setFocus(f)
    viewer?.focus(f)
  }

  function screenshot() {
    if (!viewer) return
    const url = viewer.screenshot()
    const a = document.createElement('a')
    a.href = url
    a.download = `avatar-${Date.now()}.jpg`
    a.click()
  }

  return (
    <section className={styles.viewport} aria-label="3D 视口">
      <div ref={containerRef} className={styles.canvasHost} />
      <div className={styles.hint}>
        <span className={`${styles.dot} ${busy ? styles.dotBusy : ''}`} />
        {busy ? '加载中' : '实时 3D'} · 拖动旋转 · 滚轮缩放
      </div>
      {toast && <div className={styles.toast} role="status">{toast}</div>}
      {baseError && (
        <div className={`${styles.overlay} ${styles.overlayError}`} role="alert">底模加载失败：{baseError}</div>
      )}
      <div className={styles.chips}>
        <label className={styles.chip}>
          底模
          <select
            className={styles.chipSelect}
            value={base.id}
            onChange={(e) => changeBase(e.target.value)}
            aria-label="切换底模"
          >
            {manifest.bases.map((b) => (
              <option key={b.id} value={b.id}>{b.label}</option>
            ))}
          </select>
        </label>
        <div className={styles.segmented} role="group" aria-label="相机视角">
          <button type="button" className={`${styles.segment} ${focus === 'body' ? styles.segmentActive : ''}`} onClick={() => changeFocus('body')}>全身</button>
          <button type="button" className={`${styles.segment} ${focus === 'head' ? styles.segmentActive : ''}`} onClick={() => changeFocus('head')}>头部</button>
        </div>
        <span className={styles.chip}>动画 <span className={styles.chipValue}>{animLabel}</span></span>
      </div>
      <button type="button" className={styles.iconBtn} aria-label="截图下载" title="截图下载" onClick={screenshot} disabled={!viewer}>
        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
      </button>
    </section>
  )
}
