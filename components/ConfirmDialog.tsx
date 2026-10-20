'use client'

import { useEffect, useRef } from 'react'
import styles from './confirmDialog.module.css'

interface Props {
  open: boolean
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title = '请确认',
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  const dialogRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && !loading) onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    dialogRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, loading, onCancel])

  if (!open) return null

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" onMouseDown={() => !loading && onCancel()}>
      <div ref={dialogRef} className={styles.dialog} tabIndex={-1} onMouseDown={(e) => e.stopPropagation()}>
        <div className={styles.body}>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.message}>{message}</p>
        </div>
        <div className={styles.actions}>
          <button type="button" className="btn-ghost" onClick={onCancel} disabled={loading}>{cancelText}</button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
            autoFocus
          >
            {loading ? '处理中…' : confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
