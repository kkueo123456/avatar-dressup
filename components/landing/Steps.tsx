import Link from 'next/link'
import styles from './landing.module.css'

const STEPS = [
  { no: '01', title: '选底模', text: '男性或女性，性别不匹配的衣服会自动过滤。' },
  { no: '02', title: '换衣服', text: '点一件套装一键穿上，再按部位逐件调整，发型、眉毛、配饰都在同一个面板。' },
  { no: '03', title: '生成海报', text: '选一种风格，等 AI 画完，下载到本地。' },
]

export default function Steps() {
  return (
    <>
      <section id="steps" className={styles.section} aria-label="三步流程">
        <div className={`${styles.container} ${styles.sectionInner}`}>
          <div className={styles.sectionHead}>
            <span className={`font-mark ${styles.eyebrow}`}>HOW IT WORKS</span>
            <h2 className={`font-display ${styles.h2}`}>三步，从底模到海报</h2>
          </div>
          <ol className={styles.steps}>
            {STEPS.map((s) => (
              <li key={s.no} className={styles.step}>
                <span className={`font-mark ${styles.stepNo}`}>{s.no}</span>
                <h3 className={styles.h4}>{s.title}</h3>
                <p className={styles.p}>{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>
      <section className={styles.section} aria-label="开始创建" style={{ paddingTop: 0 }}>
        <div className={`${styles.container} ${styles.ctaBand}`}>
          <div className={styles.sectionHead}>
            <h2 className={`font-display ${styles.ctaBandTitle}`}>现在就开始</h2>
            <p className={styles.p}>不用注册，不用安装，打开就是你的换装台。</p>
          </div>
          <Link href="/create" className={`btn-primary ${styles.ctaLarge}`}>开始创建</Link>
        </div>
      </section>
    </>
  )
}
