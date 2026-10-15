import Link from 'next/link'
import { requireAuth, AuthError } from '@/lib/auth'
import { prisma } from '@/lib/db'
import AvatarCard from '../../components/AvatarCard'
import styles from './avatars.module.css'

export const runtime = 'nodejs'

export default async function AvatarsPage() {
  let avatars: Awaited<ReturnType<typeof prisma.avatar.findMany>> = []
  let userName = ''

  try {
    const ctx = await requireAuth()
    userName = ctx.username
    avatars = await prisma.avatar.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
    })
  } catch (e) {
    if (e instanceof AuthError && e.status === 401) {
      return (
        <div className={styles.guest}>
          <h1>请先登录</h1>
          <p>登录后可查看和管理您的形象</p>
          <Link href="/" className="btn-primary">返回首页</Link>
        </div>
      )
    }
    throw e
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link href="/" className={styles.back}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            首页
          </Link>
          <h1 className={styles.title}>{userName} 的形象库</h1>
          <Link href="/create" className="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            新建形象
          </Link>
        </div>
      </header>

      <main className={styles.main}>
        {avatars.length === 0 ? (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2>还没有形象</h2>
            <p>去换装台创建您的第一个形象吧</p>
            <Link href="/create" className="btn-primary">开始创建</Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {avatars.map((avatar) => (
              <AvatarCard key={avatar.id} avatar={avatar} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
