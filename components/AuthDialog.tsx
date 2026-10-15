'use client'

import { useEffect, useRef, useState } from 'react'
import { useAuthStore } from '@/state/authStore'
import styles from './auth.module.css'

export default function AuthDialog() {
  const { isOpen, setOpen, mode, setMode, error, clearError, isLoading, login, register } = useAuthStore()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const firstInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setUsername('')
      setPassword('')
      clearError()
      setTimeout(() => firstInputRef.current?.focus(), 50)
    }
  }, [isOpen, mode, clearError])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    if (isOpen) {
      document.addEventListener('keydown', onKey)
      return () => document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, setOpen])

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.target === dialogRef.current) setOpen(false)
    }
    if (isOpen) {
      document.addEventListener('click', onClick)
      return () => document.removeEventListener('click', onClick)
    }
  }, [isOpen, setOpen])

  if (!isOpen) return null

  const title = mode === 'login' ? '登录' : '注册'
  const submitLabel = mode === 'login' ? '登录' : '注册'
  const switchLabel = mode === 'login' ? '还没有账号？去注册' : '已有账号？去登录'

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!username.trim() || !password) return
    if (mode === 'login') {
      await login(username.trim(), password)
    } else {
      await register(username.trim(), password)
    }
  }

  return (
    <div className={styles.overlay} ref={dialogRef} role="dialog" aria-modal="true" aria-label={title}>
      <div className={styles.dialog}>
        <div className={styles.header}>
          <h2 className={styles.title}>{title}</h2>
          <button type="button" className={styles.closeBtn} onClick={() => setOpen(false)} aria-label="关闭">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          <label className={styles.field}>
            <span className={styles.label}>用户名</span>
            <input
              ref={firstInputRef}
              type="text"
              className={styles.input}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="3-20 位字母数字下划线"
              autoComplete="username"
              required
              minLength={3}
              maxLength={20}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>密码</span>
            <input
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少 6 位"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
            />
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className="btn-primary" disabled={isLoading} style={{ width: '100%' }}>
            {isLoading ? '请稍候…' : submitLabel}
          </button>
        </form>

        <button type="button" className={styles.switch} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {switchLabel}
        </button>
      </div>
    </div>
  )
}
