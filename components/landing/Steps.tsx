import Link from 'next/link'
import styles from './landing.module.css'

const STEPS = [
  { no: '01', title: '挑角色', text: '男模或女模，选一个做你的主角。' },
  { no: '02', title: '自由搭', text: '套装一键穿，单品慢慢挑。发型、眉毛、配饰，想怎么搭都行。' },
  { no: '03', title: '出海报', text: '挑一种喜欢的风格，截图生成海报，直接保存到本地。' },
]

export default function Steps() {
  return (
    <>
      <section id="steps" className={styles.section} aria-label="三步流程">
        <div className={`${styles.container} ${styles.sectionInner}`}>
          <div className={styles.sectionHead}>
            <span className={`font-mark ${styles.eyebrow}`}>使用步骤</span>
            <h2 className={`font-display ${styles.h2}`}>三步，从形象到海报</h2>
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
            <h2 className={`font-display ${styles.ctaBandTitle}`}>现在就试试</h2>
            <p className={styles.p}>不用注册，不用安装，打开就能玩。</p>
          </div>
          <Link href="/create" className={`btn-primary ${styles.ctaLarge}`}>开始创建</Link>
        </div>
      </section>
    </>
  )
}
