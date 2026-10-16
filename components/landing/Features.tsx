import styles from './landing.module.css'

const ICON = {
  shirt: 'M8 4l4 2 4-2 4 3-2 4-2-1v11H8V10l-2 1-2-4z',
  camera: 'M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z',
  sparkles: 'M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M18.4 5.6l-2.8 2.8M8.4 15.6l-2.8 2.8',
}

const FEATURES = [
  { icon: ICON.shirt, ai: false, title: '自由搭配', text: '从头到脚随心换。套装一键穿，单品慢慢挑，发型、眉毛、配饰都能调，怎么搭都不会穿模。' },
  { icon: ICON.camera, ai: false, title: '实时预览', text: '角色会自然地呼吸和摆动，衣服跟着身体一起动。拉近看细节，拉远看整体，随时截一张满意的图。' },
  { icon: ICON.sparkles, ai: true, title: '风格海报', text: '奇幻、动漫、水彩、赛博朋克四种风格。截个图换种画风，几秒钟出一张能下载的海报。' },
]

export default function Features() {
  return (
    <section className={styles.section} aria-label="能力">
      <div className={`${styles.container} ${styles.sectionInner}`}>
        <div className={styles.sectionHead}>
          <span className={`font-mark ${styles.eyebrow}`}>能做什么</span>
          <h2 className={`font-display ${styles.h2}`}>三件小事，一个页面搞定</h2>
        </div>
        <div className={styles.cards}>
          {FEATURES.map((f) => (
            <article key={f.title} className={styles.card}>
              <span className={`${styles.icon} ${f.ai ? styles.iconAi : ''}`}>
                <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={f.icon} /></svg>
              </span>
              <h3 className={styles.h3}>{f.title}</h3>
              <p className={styles.p}>{f.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
