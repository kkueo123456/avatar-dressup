/**
 * 团队记忆检索工具
 * 优先使用 ChromaDB（语义检索），失败回退到 JSON 文件索引（关键词匹配）
 *
 * 使用流程：
 * 1. 人类写入 docs/memory/YYYY-MM-DD.md
 * 2. 运行 node scripts/sync-memory.mjs（同步到 ChromaDB + 生成 JSON 索引）
 * 3. AI 调用 retrieveMemory(query) 召回相关内容
 */

import fs from 'node:fs'
import path from 'node:path'
import { initChroma, getCollection, isChromaAvailable } from './chroma'

const MEMORY_DIR = path.resolve(process.cwd(), 'docs/memory')
const INDEX_PATH = path.join(MEMORY_DIR, '.index.json')

export interface MemoryEntry {
  file: string
  date: string
  title: string
  summary: string
  tags: string[]
  keywords: string[]
  updatedAt: string
}

export interface MemoryResult {
  entry?: MemoryEntry
  content: string
  source: 'chroma' | 'file'
  distance?: number  // ChromaDB 距离（越小越相似）
}

/* ─────────── ChromaDB 检索 ─────────── */

async function searchChroma(query: string, topK: number): Promise<MemoryResult[]> {
  await initChroma()
  const col = getCollection()
  if (!col) return []

  const res = await col.query({ queryTexts: [query], nResults: topK })
  const results: MemoryResult[] = []

  if (!res.documents?.[0]) return results

  for (let i = 0; i < res.documents[0].length; i++) {
    const doc = res.documents[0][i]
    const meta = res.metadatas?.[0]?.[i] as Record<string, string> | undefined
    const dist = res.distances?.[0]?.[i]

    if (!doc) continue

    results.push({
      content: doc,
      source: 'chroma',
      distance: typeof dist === 'number' ? dist : undefined,
      entry: meta
        ? {
            file: meta.file || '',
            date: meta.date || '',
            title: meta.title || '',
            summary: meta.summary || '',
            tags: (meta.tags || '').split(',').filter(Boolean),
            keywords: [],
            updatedAt: '',
          }
        : undefined,
    })
  }

  return results
}

/* ─────────── JSON 文件索引检索（降级） ─────────── */

function loadIndex(): Array<{ entry: MemoryEntry; content: string }> | null {
  try {
    const raw = fs.readFileSync(INDEX_PATH, 'utf-8')
    const index = JSON.parse(raw) as { entries: MemoryEntry[] }
    return index.entries.map(e => {
      const p = path.join(MEMORY_DIR, e.file)
      return { entry: e, content: fs.existsSync(p) ? fs.readFileSync(p, 'utf-8') : '' }
    })
  } catch {
    return null
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function scoreFile(entry: MemoryEntry, content: string, tokens: string[]): number {
  let s = 0
  const haystack = `${entry.title} ${entry.summary} ${entry.tags.join(' ')}`.toLowerCase()
  for (const t of tokens) {
    if (t.length < 2) continue
    if (entry.title.toLowerCase().includes(t)) s += 10
    if (entry.tags.some(tag => tag.toLowerCase() === t)) s += 8
    if (entry.keywords.some(k => k.toLowerCase().includes(t))) s += 5
    if (haystack.includes(t)) s += 2
    if (content.toLowerCase().includes(t)) s += 1
  }
  return s
}

function searchFileIndex(query: string, topK: number): MemoryResult[] {
  const data = loadIndex()
  if (!data || data.length === 0) return []

  const tokens = tokenize(query)
  if (tokens.length === 0) return []

  return data
    .map(({ entry, content }) => ({ entry, content, score: scoreFile(entry, content, tokens) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map(({ entry, content }) => ({ entry, content, source: 'file' as const }))
}

/* ─────────── 统一入口 ─────────── */

/**
 * 检索相关记忆
 * 优先 ChromaDB 语义检索，失败回退 JSON 关键词索引
 */
export async function retrieveMemory(query: string, topK = 3): Promise<MemoryResult[]> {
  // 1. 尝试 ChromaDB
  const chromaResults = await searchChroma(query, topK)
  if (chromaResults.length > 0) return chromaResults

  // 2. 降级到文件索引
  return searchFileIndex(query, topK)
}

/**
 * 格式化为 AI prompt 可用的文本
 */
export async function retrieveMemoryAsText(query: string, topK = 3): Promise<string> {
  const results = await retrieveMemory(query, topK)
  if (results.length === 0) return ''

  return results
    .map(({ entry, content, source, distance }) => {
      const src = entry
        ? `来源: ${entry.file} (${entry.date}) [${source}${distance !== undefined ? ` dist=${distance.toFixed(3)}` : ''}]`
        : `来源: ${source}`
      return `--- ${src} ---\n${content}\n`
    })
    .join('\n')
}

/**
 * 按标签过滤（仅文件索引支持，ChromaDB 可用 where 过滤但不实现）
 */
export function retrieveByTag(tag: string): Array<{ entry: MemoryEntry; content: string }> {
  const data = loadIndex()
  if (!data) return []
  return data
    .filter(({ entry }) => entry.tags.includes(tag))
    .map(({ entry, content }) => ({ entry, content }))
}
