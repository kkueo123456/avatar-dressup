'use client'
import { useEffect, useState } from 'react'
import type { Part } from '@/types/manifest'
import { useDressUp } from './DressUpContext'
import styles from './dressup.module.css'

interface Props {
  part: Part
  selected: boolean
  loading: boolean
  error?: string
  onClick: () => void
}

export default function PartCard({ part, selected, loading, error, onClick }: Props) {
  const { thumbs } = useDressUp()
  const [thumb, setThumb] = useState<string | null>(null)

  useEffect(() => {
    if (!thumbs) return
    let alive = true
    thumbs.get(part).then((url) => { if (alive) setThumb(url) }).catch(() => undefined)
    return () => { alive = false }
  }, [thumbs, part])

  const cls = [
    styles.part,
    selected ? styles.partSelected : '',
    loading ? styles.partLoading : '',
    error ? styles.partError : '',
  ].join(' ')

  return (
    <button type="button" className={cls} onClick={onClick} disabled={!!error} title={error ?? part.label} aria-pressed={selected}>
      <span className={styles.thumb}>
        {thumb ? <img src={thumb} alt="" /> : <span className={styles.thumbText}>{part.label}</span>}
      </span>
      <span className={`${styles.partLabel} ${selected ? styles.partLabelSelected : ''}`}>
        {part.label}
        {selected && !loading && (
          <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
        )}
        {loading && (
          <svg aria-hidden="true" className={styles.spin} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="2.5" strokeLinecap="round"><path d="M12 3a9 9 0 1 1-6.4 2.6" /></svg>
        )}
      </span>
      {error && <span className={styles.partNote}>加载失败</span>}
    </button>
  )
}
