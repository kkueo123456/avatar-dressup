import { getPosterProvider } from '@/poster/index'
import { parsePosterRequest } from '@/poster/request'
import { MAX_IMAGE_BYTES } from '@/poster/types'

export const runtime = 'nodejs'

/** 请求体上限：4 MB 图片的 base64 约 5.6 MB，再给 JSON 外壳留余量。超过的请求在读完前就拒绝。 */
const MAX_BODY_BYTES = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64 * 1024

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status })
}

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** 读请求体文本；声明长度或实际累计超过上限时返回 null，不把整个 body 吞进内存 */
async function readBodyText(request: Request): Promise<string | null> {
  const declared = Number(request.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return null
  if (!request.body) return ''
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BODY_BYTES) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  return new TextDecoder().decode(Buffer.concat(chunks))
}

export async function POST(request: Request): Promise<Response> {
  const text = await readBodyText(request)
  if (text === null) return jsonError(400, '图片超过 4 MB')
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return jsonError(400, '图片必须是 JPEG data URL')
  }
  const parsed = parsePosterRequest(body)
  if (!parsed.ok) return jsonError(400, parsed.error)

  let provider
  try {
    provider = getPosterProvider()
  } catch (e) {
    return jsonError(500, reasonOf(e))
  }

  try {
    const out = await provider.generate(parsed.input)
    return new Response(new Uint8Array(out), {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return jsonError(500, `海报生成失败：${reasonOf(e)}`)
  }
}
