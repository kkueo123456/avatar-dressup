/**
 * ChromaDB 客户端封装
 * 提供连接池、健康检查、自动降级到文件索引
 */

import { ChromaClient, Collection } from 'chromadb'

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8000'
const COLLECTION_NAME = 'team_memory'

let client: ChromaClient | null = null
let collection: Collection | null = null
let available = false

/** 初始化连接（幂等） */
export async function initChroma(): Promise<boolean> {
  if (available && collection) return true
  try {
    client = new ChromaClient({
      path: CHROMA_URL,
    })
    await client.heartbeat()
    collection = await client.getOrCreateCollection({
      name: COLLECTION_NAME,
      metadata: { description: 'Avatar Dressup 团队记忆库' },
    })
    available = true
    return true
  } catch (e) {
    console.warn('[chroma] 连接失败，将使用文件索引降级:', e instanceof Error ? e.message : String(e))
    available = false
    client = null
    collection = null
    return false
  }
}

/** 获取 collection（可能为 null） */
export function getCollection(): Collection | null {
  return collection
}

/** 是否可用 */
export function isChromaAvailable(): boolean {
  return available
}

/** 关闭连接 */
export async function closeChroma(): Promise<void> {
  client = null
  collection = null
  available = false
}
