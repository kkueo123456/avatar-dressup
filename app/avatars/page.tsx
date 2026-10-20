'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import AvatarCard from '../../components/AvatarCard'
import styles from './avatars.module.css'

type Filter = 'all' | 'withPoster' | 'withoutPoster'

interface AvatarItem {
  id: string
  name: string
  baseId: string
  coverUrl: string | null
  posterUrl: string | null
  createdAt: string
  mintStatus: string
  tokenId: string | null
}

export default function AvatarsPage() {
  const [avatars, setAvatars] = useState<AvatarItem[]>([])
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [userName, setUserName] = useState('')

  useEffect(() => {
    // 并行拉取形象列表和当前用户名
    Promise.all([
      fetch('/api/avatar', { credentials: 'include' }).then(async (res) => {
        if (res.status === 401) return { status: 401, avatars: [] as AvatarItem[] }
        if (!res.ok) {
          const data = (await res.json()) as { error?: string }
          throw new Error(data.error || '加载失败')
        }
        const data = (await res.json()) as { avatars: AvatarItem[] }
        return { status: 200, avatars: data.avatars }
      }),
      fetch('/api/auth/me', { credentials: 'include' }).then(async (res) => {
        if (!res.ok) return ''
        const data = (await res.json()) as { username?: string }
        return data.username ?? ''
      }).catch(() => ''),
    ])
      .then(([list, name]) => {
        if (list.status === 401) {
          setError('请先登录')
        } else {
          setAvatars(list.avatars)
          setUserName(name)
        }
        setLoading(false)
      })
      .catch((e: unknown) => {
        setError(e instanceof Error ? e.message : '加载失败')
        setLoading(false)
      })
  }, [])

  const filtered = avatars.filter((a) => {
    if (filter === 'withPoster') return !!a.posterUrl
    if (filter === 'withoutPoster') return !a.posterUrl
    return true
  })

  const counts = {
    all: avatars.length,
    withPoster: avatars.filter((a) => !!a.posterUrl).length,
    withoutPoster: avatars.filter((a) => !a.posterUrl).length,
  }

  const tabs: { key: Filter; label: string }[] = [
    { key: 'all', label: `全部 (${counts.all})` },
    { key: 'withPoster', label: `已生成海报 (${counts.withPoster})` },
    { key: 'withoutPoster', label: `未生成海报 (${counts.withoutPoster})` },
  ]

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.loading}>正在加载…</div>
      </div>
    )
  }

  if (error === '请先登录') {
    return (
      <div className={styles.guest}>
        <h1>请先登录</h1>
        <p>登录后可查看和管理您的形象</p>
        <Link href="/" className="btn-primary">返回首页</Link>
      </div>
    )
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
          <h1 className={styles.title}>{userName ? `${userName} 的形象库` : '我的形象库'}</h1>
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
          <>
            <div className={styles.tabs} role="tablist" aria-label="筛选">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.key}
                  className={`${styles.tab} ${filter === t.key ? styles.tabActive : ''}`}
                  onClick={() => setFilter(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className={styles.grid}>
              {filtered.map((avatar) => (
                <AvatarCard key={avatar.id} avatar={avatar} />
              ))}
            </div>
            {filtered.length === 0 && (
              <p className={styles.emptyHint}>该分类下暂无形象</p>
            )}
          </>
        )}
      </main>
    </div>
  )
}
