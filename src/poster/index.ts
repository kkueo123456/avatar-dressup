import { mockProvider } from './mock'
import { wanxProvider } from './real'
import type { PosterProvider } from './types'

/**
 * 按环境变量选适配器。不认识的值直接抛错，绝不静默回退到假的。
 *
 *   POSTER_PROVIDER=mock   → sharp 本地风格化（演示用，无需联网/计费）
 *   POSTER_PROVIDER=real   → 通义万相真实图生图（需 DASHSCOPE_API_KEY）
 */
export function getPosterProvider(env: Record<string, string | undefined> = process.env): PosterProvider {
  const id = env.POSTER_PROVIDER ?? ''
  if (id === 'mock') return mockProvider
  if (id === 'real') return wanxProvider
  throw new Error(`海报服务未配置: POSTER_PROVIDER=${id}`)
}
