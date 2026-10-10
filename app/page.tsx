import Features from '../components/landing/Features'
import Hero from '../components/landing/Hero'
import SiteFooter from '../components/landing/SiteFooter'
import SiteNav from '../components/landing/SiteNav'
import Steps from '../components/landing/Steps'
import styles from '../components/landing/landing.module.css'

export default function HomePage() {
  return (
    <div className={styles.page}>
      <SiteNav />
      <main>
        <Hero />
        <Features />
        <Steps />
      </main>
      <SiteFooter />
    </div>
  )
}
