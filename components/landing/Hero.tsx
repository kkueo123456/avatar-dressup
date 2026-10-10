import Link from 'next/link'
import styles from './landing.module.css'

const POSTERS = [
  { cls: styles.posterA, src: '/landing/poster-fantasy.webp', label: '奇幻插画' },
  { cls: styles.posterB, src: '/landing/poster-anime.webp', label: '动漫' },
  { cls: styles.posterC, src: '/landing/poster-cyberpunk.webp', label: '赛博朋克' },
]

export default function Hero() {
  return (
    <section className={styles.hero} aria-label="首屏">
      <div className={`${styles.container} ${styles.heroGrid}`}>
        <div className={styles.heroCopy}>
          <span className={`font-mark ${styles.eyebrow}`}>THREE.JS × AI POSTER</span>
          <h1 className={`font-display ${styles.title}`}>创建你的 3D 形象<br />换装，再让 AI 画成海报</h1>
          <p className={styles.lead}>在浏览器里实时换装：七个部位、两套服装、两个底模。满意了就一键截图，交给 AI 渲染成一张可下载的海报。</p>
          <div className={styles.ctaRow}>
            <Link href="/create" className={`btn-primary ${styles.ctaLarge}`}>
              开始创建
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </Link>
            <a href="#steps" className={`btn-ghost ${styles.ctaLarge}`}>看看三步怎么做</a>
          </div>
          <div className={styles.facts}>
            <span className={styles.fact}>无需安装，打开即用</span>
            <span className={styles.fact}>素材 CC0，可商用</span>
          </div>
        </div>
        <div className={styles.art} role="img" aria-label="三张 AI 海报示意">
          {POSTERS.map((p) => (
            <div key={p.src} className={`${styles.poster} ${p.cls}`}>
              <img src={p.src} width={220} height={330} alt="" />
              <span className={styles.badge}>AI 海报</span>
              <span className={`font-display ${styles.posterLabel}`}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
