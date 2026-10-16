/**
 * 同步团队记忆到 ChromaDB（优先）+ 生成 JSON 索引（降级备用）
 * 用法：npm run memory:sync
 *
 * 前置条件（可选）：ChromaDB 服务器已启动
 *   Docker: npm run memory:up
 *   或手动: docker run -d -p 8000:8000 chromadb/chroma:latest
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ChromaClient } from 'chromadb'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const MEMORY_DIR = path.resolve(__dirname, '../docs/memory')
const INDEX_FILE = path.join(MEMORY_DIR, '.index.json')

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000'
const COLLECTION_NAME = 'team_memory'

/* ─────────── 工具函数 ─────────── */
function readFile(filePath) {
  try { return fs.readFileSync(filePath, 'utf-8') } catch { return '' }
}

function extractTitle(content) {
  const m = content.match(/^#\s+(.+)$/m)
  return m ? m[1].trim() : ''
}

function extractTags(content) {
  const tags = new Set()
  for (const m of content.matchAll(/#([a-zA-Z0-9_\-\u4e00-\u9fa5]+)/g)) tags.add(m[1])
  return Array.from(tags)
}

function extractSummary(content) {
  const body = content
    .replace(/#+\s+/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*`]/g, '')
    .replace(/\n+/g, ' ')
    .trim()
  return body.slice(0, 300) + (body.length > 300 ? '...' : '')
}

/* ─────────── ChromaDB 同步 ─────────── */
async function syncToChroma(files) {
  let client
  try {
    client = new ChromaClient({ path: CHROMA_URL })
    await client.heartbeat()
  } catch (e) {
    console.warn('[sync-memory] ChromaDB 连接失败:', e.message || String(e))
    return false
  }

  const col = await client.getOrCreateCollection({
    name: COLLECTION_NAME,
    metadata: { description: 'Avatar Dressup team memory' },
  })

  // 清空旧数据（全量同步）
  const existing = await col.get({ limit: 10000 })
  if (existing.ids.length > 0) {
    await col.delete({ ids: existing.ids })
    console.log(`[sync-memory] 已清理 ${existing.ids.length} 条旧记录`)
  }

  const ids = []
  const documents = []
  const metadatas = []

  for (const file of files) {
    const filePath = path.join(MEMORY_DIR, file)
    const content = readFile(filePath)
    if (!content.trim()) continue

    const date = file.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || ''
    const title = extractTitle(content)
    const tags = extractTags(content)
    const summary = extractSummary(content)

    ids.push(file.replace('.md', ''))
    documents.push(content)
    metadatas.push({ file, date, title, summary: summary.slice(0, 500), tags: tags.join(',') })
  }

  if (ids.length > 0) {
    await col.add({ ids, documents, metadatas })
    console.log(`[sync-memory] 已写入 ChromaDB: ${ids.length} 条`)
  } else {
    console.log('[sync-memory] ChromaDB: 无内容可写入')
  }
  return true
}

/* ─────────── JSON 索引同步 ─────────── */
function syncToJson(files) {
  const entries = []
  for (const file of files) {
    const filePath = path.join(MEMORY_DIR, file)
    const content = readFile(filePath)
    if (!content.trim()) continue

    const date = file.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] || ''
    const title = extractTitle(content)
    const tags = extractTags(content)
    const summary = extractSummary(content)

    entries.push({
      file,
      date,
      title,
      summary,
      tags,
      keywords: [...tags, ...title.split(/\s+/)],
      updatedAt: fs.statSync(filePath).mtime.toISOString(),
    })
  }

  fs.writeFileSync(INDEX_FILE, JSON.stringify({
    generatedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  }, null, 2), 'utf-8')

  console.log(`[sync-memory] 已生成 JSON 索引: ${entries.length} 条 → docs/memory/.index.json`)
}

/* ─────────── 主流程 ─────────── */
async function main() {
  const files = fs.readdirSync(MEMORY_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('.') && f !== 'README.md')
    .sort()

  const chromaOk = await syncToChroma(files)
  syncToJson(files)

  if (!chromaOk) {
    console.log('[sync-memory] 提示：当前使用 JSON 索引（关键词匹配）。如需语义检索，启动 ChromaDB:')
    console.log('  npm run memory:up')
  }
}

main().catch(e => {
  console.error('[sync-memory] 失败:', e)
  process.exit(1)
})
