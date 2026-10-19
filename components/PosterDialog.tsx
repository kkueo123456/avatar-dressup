'use client'
import { useEffect, useRef, useState } from 'react'
import { POSTER_STYLES, POSTER_STYLE_LABELS, type PosterStyle } from '@/poster/types'
import styles from './poster.module.css'

type State =
  | { kind: 'pick' }
  | { kind: 'busy' }
  | { kind: 'done'; url: string; style: PosterStyle }
  | { kind: 'error'; message: string }

const STYLE_KEY = 'avatar-dressup:poster-style'
const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** 可被 AbortSignal 中断的 sleep */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, ms)
    const onAbort = () => {
      clearTimeout(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    }
    if (signal.aborted) {
      onAbort()
      return
    }
    signal.addEventListener('abort', onAbort, { once: true })
  })
}

interface Props {
  open: boolean
  onClose: () => void
  /** 返回当前视口的 JPEG data URL */
  screenshot: () => string
  /** 海报生成完成后回调（传入海报图片 URL） */
  onDone?: (posterUrl: string) => void
}

export default function PosterDialog({ open, onClose, screenshot, onDone }: Props) {
  const [style, setStyle] = useState<PosterStyle>('fantasy')
  const [state, setState] = useState<State>({ kind: 'pick' })
  const dialogRef = useRef<HTMLDivElement | null>(null)
  /** 在途请求；关闭弹窗或又点一次生成时先中止它 */
  const abortRef = useRef<AbortController | null>(null)
  /** 请求序号；中止可能晚于响应，序号能保证只有最新一轮写状态 */
  const runRef = useRef(0)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  // 记住上次选的风格；localStorage 不可用时忽略
  useEffect(() => {
    try {
      const s = localStorage.getItem(STYLE_KEY)
      if (s && (POSTER_STYLES as readonly string[]).includes(s)) setStyle(s as PosterStyle)
    } catch {
      // 忽略
    }
  }, [])

  // 关闭时中止在途请求并回到选风格态；关掉后回来的响应不许再写状态
  useEffect(() => {
    if (open) return
    abortRef.current?.abort()
    abortRef.current = null
    runRef.current += 1
    setState({ kind: 'pick' })
  }, [open])

  // 卸载时同样中止，避免请求回来时往已卸载的组件写状态、留下悬挂的 blob URL
  useEffect(() => () => {
    abortRef.current?.abort()
    runRef.current += 1
  }, [])

  // 离开 done 态或卸载时释放 blob URL
  useEffect(() => {
    return () => {
      if (state.kind === 'done') URL.revokeObjectURL(state.url)
    }
  }, [state])

  // 打开时焦点进入弹窗、Esc 关闭、Tab 在弹窗内循环；关闭后焦点还给触发按钮
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusables = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
      )
    ;(focusables()[0] ?? dialogRef.current)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (!items.length) {
        // 生成中弹窗里没有可聚焦元素，就把焦点留在弹窗容器上，别让它跑到后面的面板
        e.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && !!dialogRef.current?.contains(active)
      if (e.shiftKey && (!inside || active === first)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (!inside || active === last)) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previous?.isConnected) previous.focus()
    }
  }, [open])

  function pick(s: PosterStyle) {
    setStyle(s)
    try {
      localStorage.setItem(STYLE_KEY, s)
    } catch {
      // 忽略
    }
  }

  async function generate() {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const run = ++runRef.current
    const alive = () => run === runRef.current && !controller.signal.aborted

    setState({ kind: 'busy' })
    try {
      const image = screenshot()
      const res = await fetch('/api/poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, style }),
        signal: controller.signal,
      })
      if (!res.ok) {
        let message = `请求失败（HTTP ${res.status}）`
        try {
          const data = (await res.json()) as { error?: string }
          if (data.error) message = data.error
        } catch {
          // 保留默认文案
        }
        if (alive()) setState({ kind: 'error', message })
        return
      }
      const { jobId } = (await res.json()) as { jobId: string }

      // 轮询：每 2 秒查一次状态，直到 done / failed / 被中止
      while (alive()) {
        try {
          await delay(2000, controller.signal)
        } catch {
          return // 被中止
        }
        if (!alive()) return

        const r = await fetch(`/api/poster/${jobId}`, { signal: controller.signal })
        if (!r.ok) continue
        const data = (await r.json()) as {
          status: string
          resultImageUrl?: string
          errorMessage?: string
        }

        if (data.status === 'done') {
          if (alive()) {
            setState({ kind: 'done', url: data.resultImageUrl!, style })
            if (onDone && data.resultImageUrl) onDone(data.resultImageUrl)
          }
          return
        }
        if (data.status === 'failed') {
          if (alive()) setState({ kind: 'error', message: data.errorMessage || '生成失败' })
          return
        }
        // pending / running：继续下一轮
      }
    } catch (e) {
      if (!alive()) return
      setState({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
    }
  }

  if (!open) return null
  const fileName = `avatar-poster-${style}-${new Date().toISOString().slice(0, 10)}.jpg`

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="poster-title">
      <div ref={dialogRef} className={styles.dialog} tabIndex={-1}>
        <div className={styles.head}>
          <h2 id="poster-title" className={`font-display ${styles.title}`}>生成海报</h2>
          <button type="button" className={styles.close} aria-label="关闭" onClick={onClose}>×</button>
        </div>

        {state.kind === 'pick' && (
          <>
            <p className={styles.lead}>选一种风格，把当前形象交给 AI 画成一张海报。</p>
            <div className={styles.previewWrap}>
              <div
                className={`${styles.preview} ${
                  style === 'fantasy'
                    ? styles.previewFantasy
                    : style === 'anime'
                      ? styles.previewAnime
                      : style === 'watercolor'
                        ? styles.previewWatercolor
                        : styles.previewCyberpunk
                }`}
                aria-hidden="true"
              >
                <span className={styles.previewLabel}>{POSTER_STYLE_LABELS[style]}</span>
              </div>
            </div>
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
            <p>正在生成海报，请稍候…</p>
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
