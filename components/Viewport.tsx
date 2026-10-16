'use client'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { useStore } from 'zustand'
import { message } from 'antd'
import { selectBase } from '@/state/avatarStore'
import type { BaseModel } from '@/types/manifest'
import { useDressUp } from './DressUpContext'
import styles from './dressup.module.css'

type Focus = 'body' | 'head'

interface BaseSelectorProps {
  bases: BaseModel[]
  current: string
  onChange: (id: string) => void
}

/** 自定义底模下拉：和 chips 风格一致，不再用原生 select 的浅色系统弹窗 */
function BaseSelector({ bases, current, onChange }: BaseSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const currentBase = bases.find((b) => b.id === current)
  const currentLabel = currentBase?.label ?? current

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const idx = bases.findIndex((b) => b.id === current)
      const delta = e.key === 'ArrowDown' ? 1 : -1
      const next = bases[(idx + delta + bases.length) % bases.length]
      if (next) onChange(next.id)
    }
  }

  return (
    <div className={styles.baseSelector} ref={ref} onKeyDown={onKeyDown}>
      <button
        type="button"
        className={`${styles.baseTrigger} ${open ? styles.baseTriggerOpen : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="base-listbox"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.baseLabel}>底模</span>
        <span className={styles.baseValue}>{currentLabel}</span>
        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={open ? styles.baseArrowUp : ''}>
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <ul id="base-listbox" role="listbox" className={styles.baseList}>
          {bases.map((b) => (
            <li
              key={b.id}
              role="option"
              aria-selected={b.id === current}
              className={`${styles.baseOption} ${b.id === current ? styles.baseOptionSelected : ''}`}
              onClick={() => {
                onChange(b.id)
                setOpen(false)
              }}
            >
              {b.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function Viewport({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const { manifest, store, viewer, loadingIds, errors } = useDressUp()
  const base = useStore(store, (s) => selectBase(manifest, s))
  const [focus, setFocus] = useState<Focus>('body')

  // 只看当前底模的错误；换到别的底模成功后遮罩就该消失
  const baseError = errors.get(base.id)
  const busy = loadingIds.size > 0
  const animLabel = manifest.animations[0]?.label ?? '无'

  function changeBase(id: string) {
    const next = manifest.bases.find((b) => b.id === id)
    if (!next || next.id === base.id) return
    const removed = store.getState().setBase(next)
    // 换底模后 view 里会自动回全身机位，分段控件要跟着回到「全身」，别停在「头部」
    setFocus('body')
    if (removed.length) message.info(`已卸下 ${removed.length} 件不匹配的部件：${removed.map((p) => p.label).join('、')}`)
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
      {/* 加载中遮住画布，避免出现 t-pose 一瞬；底模/动画/部件任一在加载都遮 */}
      {!baseError && busy && (
        <div className={`${styles.overlay} ${styles.overlayLoading}`} role="status" aria-live="polite">
          <div className={styles.spinner} aria-hidden="true" />
          <span>加载中…</span>
        </div>
      )}
      {baseError && (
        <div className={`${styles.overlay} ${styles.overlayError}`} role="alert">底模加载失败：{baseError}</div>
      )}
      <div className={styles.chips}>
        <BaseSelector bases={manifest.bases} current={base.id} onChange={changeBase} />
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
