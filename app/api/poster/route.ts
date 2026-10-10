import { getPosterProvider } from '@/poster/index'
import { parsePosterRequest } from '@/poster/request'

export const runtime = 'nodejs'

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status })
}

function reasonOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
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
