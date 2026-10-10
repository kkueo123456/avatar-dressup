import Link from 'next/link'
import styles from './landing.module.css'

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL

export default function SiteNav() {
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
        <Link href="/create" className="btn-primary">开始创建</Link>
      </nav>
    </header>
  )
}
