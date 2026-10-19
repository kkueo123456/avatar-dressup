'use client'

import { useEffect, useRef, useState } from 'react'
import styles from './saveDialog.module.css'

interface Props {
  open: boolean
  onClose: () => void
  onSave: (name: string, withPoster: boolean) => Promise<void>
  isLoading?: boolean
}

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export default function SaveDialog({ open, onClose, onSave, isLoading }: Props) {
  const [name, setName] = useState('')
  const [withPoster, setWithPoster] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dialogRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const onCloseRef = useRef(onClose)

  useEffect(() => { onCloseRef.current = onClose }, [onClose])

  useEffect(() => {
    if (open) {
      setName('')
      setWithPoster(false)
      setError(null)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    function focusables() {
      return Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []).filter(
        (el) => !el.hasAttribute('disabled') && el.getClientRects().length > 0,
      )
    }
    ;(focusables()[0] ?? dialogRef.current)?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCloseRef.current()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (!items.length) { e.preventDefault(); dialogRef.current?.focus(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && !!dialogRef.current?.contains(active)
      if (e.shiftKey && (!inside || active === first)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (!inside || active === last)) { e.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previous?.isConnected) previous.focus()
    }
  }, [open])

  async function handleSubmit(withPosterFlag: boolean) {
    const trimmed = name.trim()
    if (!trimmed) {
      setError('请输入形象名称')
      return
    }
    if (trimmed.length > 20) {
      setError('名称最多 20 个字符')
      return
    }
    setError(null)
    try {
      await onSave(trimmed, withPosterFlag)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    }
  }

  if (!open) return null

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="save-title">
      <div ref={dialogRef} className={styles.dialog} tabIndex={-1}>
        <div className={styles.head}>
          <h2 id="save-title" className={`font-display ${styles.title}`}>保存形象</h2>
          <button type="button" className={styles.close} aria-label="关闭" onClick={onClose}>×</button>
        </div>

        <div className={styles.body}>
          <label className={styles.field}>
            <span className={styles.label}>形象名称 <span className={styles.hint}>(最多 20 字符)</span></span>
            <input
              ref={inputRef}
              type="text"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value.slice(0, 20))}
              placeholder="给形象起个名字"
              maxLength={20}
              required
              disabled={isLoading}
            />
          </label>

          <div className={styles.optionGroup}>
            <span className={styles.optionLabel}>是否同时生成资产海报？</span>
            <div className={styles.optionChips} role="radiogroup" aria-label="海报选项">
              <button
                type="button"
                role="radio"
                aria-checked={!withPoster}
                className={`${styles.optionChip} ${!withPoster ? styles.optionChipActive : ''}`}
                onClick={() => setWithPoster(false)}
                disabled={isLoading}
              >
                仅保存形象
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={withPoster}
                className={`${styles.optionChip} ${withPoster ? styles.optionChipActive : ''}`}
                onClick={() => setWithPoster(true)}
                disabled={isLoading}
              >
                保存并生成海报
              </button>
            </div>
          </div>

          {error && <p className={styles.error} role="alert">{error}</p>}
        </div>

        <div className={styles.actions}>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={isLoading}>取消</button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => handleSubmit(withPoster)}
            disabled={isLoading || !name.trim()}
          >
            {isLoading ? '保存中…' : withPoster ? '保存并生成海报' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
