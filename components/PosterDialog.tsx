'use client'
import { useEffect, useState } from 'react'
import { POSTER_STYLES, POSTER_STYLE_LABELS, type PosterStyle } from '@/poster/types'
import styles from './poster.module.css'

type State =
  | { kind: 'pick' }
  | { kind: 'busy' }
  | { kind: 'done'; url: string; style: PosterStyle }
  | { kind: 'error'; message: string }

const STYLE_KEY = 'avatar-dressup:poster-style'

interface Props {
  open: boolean
  onClose: () => void
  /** 返回当前视口的 JPEG data URL */
  screenshot: () => string
}

export default function PosterDialog({ open, onClose, screenshot }: Props) {
  const [style, setStyle] = useState<PosterStyle>('fantasy')
  const [state, setState] = useState<State>({ kind: 'pick' })

  // 记住上次选的风格；localStorage 不可用时忽略
  useEffect(() => {
    try {
      const s = localStorage.getItem(STYLE_KEY)
      if (s && (POSTER_STYLES as readonly string[]).includes(s)) setStyle(s as PosterStyle)
    } catch {
      // 忽略
    }
  }, [])

  useEffect(() => {
    if (!open) setState({ kind: 'pick' })
  }, [open])

  // 离开 done 态或卸载时释放 blob URL
  useEffect(() => {
    return () => {
      if (state.kind === 'done') URL.revokeObjectURL(state.url)
    }
  }, [state])

  function pick(s: PosterStyle) {
    setStyle(s)
    try {
      localStorage.setItem(STYLE_KEY, s)
    } catch {
      // 忽略
    }
  }

  async function generate() {
    setState({ kind: 'busy' })
    try {
      const image = screenshot()
      const res = await fetch('/api/poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, style }),
      })
      if (!res.ok) {
        let message = `请求失败（HTTP ${res.status}）`
        try {
          const data = (await res.json()) as { error?: string }
          if (data.error) message = data.error
        } catch {
          // 响应不是 JSON，保留默认文案
        }
        setState({ kind: 'error', message })
        return
      }
      const blob = await res.blob()
      setState({ kind: 'done', url: URL.createObjectURL(blob), style })
    } catch (e) {
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  if (!open) return null
  const fileName = `avatar-poster-${style}-${new Date().toISOString().slice(0, 10)}.jpg`

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="poster-title">
      <div className={styles.dialog}>
        <div className={styles.head}>
          <h2 id="poster-title" className={`font-display ${styles.title}`}>生成海报</h2>
          <button type="button" className={styles.close} aria-label="关闭" onClick={onClose}>×</button>
        </div>

        {state.kind === 'pick' && (
          <>
            <p className={styles.lead}>选一种风格，把当前形象交给 AI 画成一张海报。</p>
            <div className={styles.chips} role="radiogroup" aria-label="风格">
              {POSTER_STYLES.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={s === style}
                  className={`${styles.chip} ${s === style ? styles.chipActive : ''}`}
                  onClick={() => pick(s)}
                >
                  {POSTER_STYLE_LABELS[s]}
                </button>
              ))}
            </div>
            <div className={styles.actions}>
              <button type="button" className="btn-ghost" onClick={onClose}>取消</button>
              <button type="button" className="btn-primary" onClick={generate}>生成</button>
            </div>
          </>
        )}

        {state.kind === 'busy' && (
          <div className={styles.busy} aria-live="polite">
            <div className={styles.skeleton} />
            <p>正在渲染，约 20 秒…</p>
          </div>
        )}

        {state.kind === 'done' && (
          <>
            <img className={styles.result} src={state.url} alt={`${POSTER_STYLE_LABELS[state.style]}风格的海报`} />
            <div className={styles.actions}>
              <button type="button" className="btn-ghost" onClick={() => setState({ kind: 'pick' })}>换个风格</button>
              <a className="btn-primary" href={state.url} download={fileName}>下载</a>
            </div>
          </>
        )}

        {state.kind === 'error' && (
          <>
            <p className={styles.error} role="alert">{state.message}</p>
            <div className={styles.actions}>
              <button type="button" className="btn-ghost" onClick={onClose}>关闭</button>
              <button type="button" className="btn-primary" onClick={generate}>重试</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
