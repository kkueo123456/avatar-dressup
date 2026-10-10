import styles from './landing.module.css'

const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL

export default function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${styles.container} ${styles.footerInner}`}>
        <span className={`font-mark ${styles.footerBrand}`}>AVATAR DRESSUP</span>
        <span>素材来自 Quaternius，CC0 许可 · three.js 渲染 · {new Date().getFullYear()}</span>
        {REPO_URL ? <a href={REPO_URL} className={styles.footerLink} target="_blank" rel="noreferrer">GitHub</a> : <span />}
      </div>
    </footer>
  )
}
