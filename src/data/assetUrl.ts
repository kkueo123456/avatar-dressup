/** 构建期常量：Next 会把 NEXT_PUBLIC_* 内联进客户端包 */
const DEFAULT_BASE = process.env.NEXT_PUBLIC_ASSET_BASE || '/avatar/'

/** 把 manifest 里的相对路径拼成可请求的 URL */
export function assetUrl(path: string, base: string = DEFAULT_BASE): string {
  const prefix = base.endsWith('/') ? base : `${base}/`
  return prefix + path.replace(/^\/+/, '')
}
