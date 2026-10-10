'use client'
import Link from 'next/link'
import styles from './dressup.module.css'

export default function TopBar({ onPoster }: { onPoster?: () => void }) {
  return (
    <header className={styles.topbar}>
      <Link href="/" className={styles.brand}>
        <span className={`font-mark ${styles.brandMark}`}>AVATAR DRESSUP</span>
        <span className={styles.brandSub}>换装台</span>
      </Link>
      <nav className={styles.topbarNav} aria-label="主导航">
        <button type="button" className="btn-primary" onClick={onPoster} disabled={!onPoster}>
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8" />
          </svg>
          生成海报
        </button>
      </nav>
    </header>
  )
}
