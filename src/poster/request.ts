import { isPosterStyle, MAX_IMAGE_BYTES, type PosterInput } from './types'

export type ParseResult = { ok: true; input: PosterInput } | { ok: false; error: string }

const PREFIX = 'data:image/jpeg;base64,'
const BAD_IMAGE = '图片必须是 JPEG data URL'
const MAX_PROMPT_LENGTH = 200

/** 校验 /api/poster 的请求体。体积先按 base64 长度估算，超限时不解码。 */
export function parsePosterRequest(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null) return { ok: false, error: BAD_IMAGE }
  const { image, style, prompt } = body as { image?: unknown; style?: unknown; prompt?: unknown }
  if (typeof image !== 'string' || !image.startsWith(PREFIX)) return { ok: false, error: BAD_IMAGE }
  const b64 = image.slice(PREFIX.length)
  if (Math.floor((b64.length * 3) / 4) > MAX_IMAGE_BYTES) return { ok: false, error: '图片超过 4 MB' }
  if (!isPosterStyle(style)) return { ok: false, error: '未知风格' }
  // 提示词可选：给就必须是长度合规的字符串（服务端再 trim，防纯空白）
  let cleanPrompt: string | undefined
  if (prompt !== undefined && prompt !== null && prompt !== '') {
    if (typeof prompt !== 'string') return { ok: false, error: '提示词格式非法' }
    cleanPrompt = prompt.trim().slice(0, MAX_PROMPT_LENGTH) || undefined
  }
  const buf = Buffer.from(b64, 'base64')
  // JPEG 文件头 FF D8
  if (buf.length < 2 || buf[0] !== 0xff || buf[1] !== 0xd8) return { ok: false, error: BAD_IMAGE }
  return { ok: true, input: { image: buf, style, prompt: cleanPrompt } }
}
