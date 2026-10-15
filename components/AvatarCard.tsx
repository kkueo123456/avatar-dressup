'use client'

import Link from 'next/link'
import { useState } from 'react'
import styles from './avatarCard.module.css'

interface AvatarCardProps {
  avatar: {
    id: string
    name: string
    baseId: string
    coverUrl: string | null
    createdAt: Date
    mintStatus: string
    tokenId: string | null
  }
}

export default function AvatarCard({ avatar }: AvatarCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleted, setDeleted] = useState(false)

  if (deleted) return null

  const statusBadge: Record<string, { label: string; cls: string }> = {
    UNMINTED: { label: '未铸造', cls: styles.badgeUnminted },
    MINTING: { label: '铸造中', cls: styles.badgeMinting },
    MINTED: { label: '已铸造', cls: styles.badgeMinted },
  }
  const badge = statusBadge[avatar.mintStatus] ?? statusBadge.UNMINTED

  async function onDelete(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`确定要删除形象「${avatar.name}」吗？`)) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/avatar/${avatar.id}`, { method: 'DELETE', credentials: 'include' })
      if (res.ok) {
        setDeleted(true)
      } else {
        const data = (await res.json()) as { error?: string }
        alert(data.error || '删除失败')
      }
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className={styles.card}>
      <Link href={`/create?id=${avatar.id}`} className={styles.link}>
        <div className={styles.cover}>
          {avatar.coverUrl ? (
            <img src={avatar.coverUrl} alt={avatar.name} className={styles.img} />
          ) : (
            <div className={styles.placeholder}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                <circle cx="9" cy="9" r="2" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
              <span>暂无封面</span>
            </div>
          )}
          <div className={styles.overlay}>
            <span className={styles.editHint}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              </svg>
              点击编辑
            </span>
          </div>
        </div>
      </Link>

      <div className={styles.info}>
        <div className={styles.row}>
          <h3 className={styles.name} title={avatar.name}>{avatar.name}</h3>
          <span className={`${styles.badge} ${badge.cls}`}>{badge.label}</span>
        </div>
        <div className={styles.meta}>
          <span>{new Date(avatar.createdAt).toLocaleDateString('zh-CN')}</span>
          <span className={styles.sep}>·</span>
          <span>{avatar.baseId}</span>
        </div>
      </div>

      <div className={styles.actions}>
        <Link href={`/create?id=${avatar.id}`} className={styles.actionBtn} title="编辑">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </Link>
        <button type="button" className={styles.actionBtn} title="删除" onClick={onDelete} disabled={isDeleting}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
