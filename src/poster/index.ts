import { mockProvider } from './mock'
import type { PosterProvider } from './types'

/** 按环境变量选适配器。不认识的值直接抛错，绝不静默回退到假的。 */
export function getPosterProvider(env: Record<string, string | undefined> = process.env): PosterProvider {
  const id = env.POSTER_PROVIDER ?? ''
  if (id === 'mock') return mockProvider
  throw new Error(`海报服务未配置: POSTER_PROVIDER=${id}`)
}
