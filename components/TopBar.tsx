'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@/state/authStore'
import styles from './dressup.module.css'

export default function TopBar({ onSave }: { onSave?: () => void }) {
  const { user, setOpen, logout } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', onDocClick)
      return () => document.removeEventListener('mousedown', onDocClick)
    }
  }, [menuOpen])

  return (
    <header className={styles.topbar}>
      <Link href="/" className={styles.brand}>
        <span className={`font-mark ${styles.brandMark}`}>AVATAR DRESSUP</span>
        <span className={styles.brandSub}>换装台</span>
      </Link>

      <nav className={styles.topbarNav} aria-label="主导航">
        <button type="button" className="btn-primary" onClick={onSave} disabled={!onSave}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          保存
        </button>

        {user ? (
          <div className={styles.userMenu} ref={menuRef}>
            <button
              type="button"
              className={styles.userTrigger}
              onClick={() => setMenuOpen((v) => !v)}
              aria-expanded={menuOpen}
              aria-haspopup="menu"
            >
              <span className={styles.userAvatar}>{user.username[0].toUpperCase()}</span>
              <span className={styles.userName}>{user.username}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: menuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 150ms ease' }}>
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {menuOpen && (
              <ul className={styles.userDropdown} role="menu">
                <li role="none">
                  <Link href="/avatars" className={styles.userItem} role="menuitem" onClick={() => setMenuOpen(false)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    我的形象
                  </Link>
                </li>
                <li role="none">
                  <button
                    type="button"
                    className={styles.userItem}
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); logout() }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" x2="9" y1="12" y2="12" />
                    </svg>
                    退出登录
                  </button>
                </li>
              </ul>
            )}
          </div>
        ) : (
          <button type="button" className="btn-ghost" onClick={() => setOpen(true)}>
            登录
          </button>
        )}
      </nav>
    </header>
  )
}
