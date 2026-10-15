import { prisma } from '@/lib/db'
import { parsePosterRequest } from '@/poster/request'
import { MAX_IMAGE_BYTES } from '@/poster/types'

export const runtime = 'nodejs'

const MAX_BODY_BYTES = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64 * 1024

function jsonError(status: number, error: string): Response {
  return Response.json({ error }, { status })
}

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

  const { image, style } = body as { image: string; style: string }

  const job = await prisma.posterJob.create({
    data: {
      style,
      inputImageUrl: image,
      status: 'pending',
    },
  })

  return Response.json({ jobId: job.id }, { status: 201 })
}
