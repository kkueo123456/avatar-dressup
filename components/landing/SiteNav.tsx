'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { useAuthStore } from '@/state/authStore'
import styles from './landing.module.css'

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL

export default function SiteNav() {
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
    <header className={styles.nav}>
      <Link href="/" className={`font-mark ${styles.brand}`}>AVATAR DRESSUP</Link>
      <nav className={styles.navLinks} aria-label="主导航">
        <a href="#steps" className="btn-ghost">怎么做</a>
        {REPO_URL && (
          <a href={REPO_URL} className="btn-ghost" target="_blank" rel="noreferrer">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 19c-4.5 1.5-4.5-2.5-6-3M15 21v-3.5c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.7 11.7 0 0 0-6.2 0C6.5 2.8 5.5 3.1 5.5 3.1a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 4 9.5c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
            </svg>
            GitHub
          </a>
        )}

        {user ? (
          <div className={styles.userMenu} ref={menuRef}>
            <button
              type="button"
              className={styles.userTrigger}
              onClick={() => setMenuOpen((v) => !v)}
              onMouseEnter={() => setMenuOpen(true)}
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
              <ul className={styles.userDropdown} role="menu" onMouseLeave={() => setMenuOpen(false)}>
                <li role="none">
                  <Link href="/avatars" className={styles.userItem} role="menuitem" onClick={() => setMenuOpen(false)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    我的作品
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
          <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
            登录
          </button>
        )}
      </nav>
    </header>
  )
}
