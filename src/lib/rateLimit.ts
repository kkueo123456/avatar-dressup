/**
 * 进程内简单限流（滑动窗口版）。
 *
 * 适用：单进程部署（如本项目 PM2 单实例）。
 * 局限：多实例/多机部署时各进程计数独立，会放宽上限——届时请换 Redis。
 */

interface Bucket {
  /** 窗口内已用次数 */
  count: number
  /** 窗口重置时间戳（ms） */
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** 周期性清理过期桶，避免内存无限增长 */
const CLEANUP_EVERY = 1000
let opsSinceCleanup = 0

export interface RateLimitResult {
  ok: boolean
  /** 剩余可用次数 */
  remaining: number
  /** 距离重置的秒数，用于 Retry-After 头 */
  retryAfter: number
}

/**
 * @param key  限流维度键，如 `login:1.2.3.4`
 * @param max   窗口内允许的最大次数
 * @param windowMs 窗口长度（毫秒）
 */
export function rateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now()

  if (++opsSinceCleanup >= CLEANUP_EVERY) {
    opsSinceCleanup = 0
    for (const [k, b] of buckets) {
      if (b.resetAt < now) buckets.delete(k)
    }
  }

  const entry = buckets.get(key)
  if (!entry || entry.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: max - 1, retryAfter: 0 }
  }

  entry.count += 1
  if (entry.count > max) {
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    }
  }
  return { ok: true, remaining: max - entry.count, retryAfter: 0 })
}

/** 从请求中取客户端 IP（穿透反代后的真实 IP） */
export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) {
    const first = xff.split(',')[0]?.trim()
    if (first) return first
  }
  return request.headers.get('x-real-ip') ?? 'unknown'
}
