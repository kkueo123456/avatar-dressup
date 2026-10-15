import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { parsePosterRequest } from '@/poster/request'
import { MAX_IMAGE_BYTES } from '@/poster/types'
import { prisma } from '@/lib/db'
import { POST } from '../app/api/poster/route'
import { GET } from '../app/api/poster/[jobId]/route'

vi.mock('@/poster/request', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/poster/request')>()
  return { ...actual, parsePosterRequest: vi.fn(actual.parsePosterRequest) }
})

const parseSpy = vi.mocked(parsePosterRequest)

beforeAll(async () => {
  // 确保测试数据库可连
  await prisma.$connect()
})

afterEach(async () => {
  parseSpy.mockClear()
  // 清理测试产生的 job
  await prisma.posterJob.deleteMany({
    where: { inputImageUrl: { startsWith: 'data:image/jpeg;base64,' } },
  })
})

function req(body: unknown): Request {
  return new Request('http://localhost/api/poster', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

function fakeRequest(contentLength: number, body: string): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(body))
      controller.close()
    },
  })
  return { headers: new Headers({ 'content-length': String(contentLength) }), body: stream } as unknown as Request
}

async function jpegDataUrl(): Promise<string> {
  const sharp = (await import('sharp')).default
  const buf = await sharp({ create: { width: 64, height: 96, channels: 3, background: '#806050' } }).jpeg().toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

async function getJob(jobId: string): Promise<ReturnType<typeof GET>> {
  return GET(new Request(`http://localhost/api/poster/${jobId}`), { params: Promise.resolve({ jobId }) })
}

describe('POST /api/poster', () => {
  it('请求体不是 JSON 时 400', async () => {
    const res = await POST(req('not json'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '图片必须是 JPEG data URL' })
  })

  it('校验失败时 400 带固定文案', async () => {
    const res = await POST(req({ image: await jpegDataUrl(), style: 'oil' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '未知风格' })
  })

  it('请求体超过上限时直接 400，不解析 JSON', async () => {
    const huge = `{"image":"${'A'.repeat(7 * 1024 * 1024)}","style":"anime"}`
    const res = await POST(req(huge))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '图片超过 4 MB' })
  })

  it('声明长度就超过上限时直接 400，不进请求解析', async () => {
    const body = JSON.stringify({ image: await jpegDataUrl(), style: 'fantasy' })
    const overLimit = Math.ceil((MAX_IMAGE_BYTES * 4) / 3) + 64 * 1024 + 1
    const res = await POST(fakeRequest(overLimit, body))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '图片超过 4 MB' })
    expect(parseSpy).not.toHaveBeenCalled()
  })

  it('格式合法时立刻返回 201 与 jobId，不再同步生成图', async () => {
    const res = await POST(req({ image: await jpegDataUrl(), style: 'fantasy' }))
    expect(res.status).toBe(201)
    const body = (await res.json()) as { jobId: string }
    expect(typeof body.jobId).toBe('string')
    expect(body.jobId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

    // 数据库里应为 pending
    const job = await prisma.posterJob.findUnique({ where: { id: body.jobId } })
    expect(job).not.toBeNull()
    expect(job!.status).toBe('pending')
    expect(job!.style).toBe('fantasy')
  })

  it('FF D8 开头但内容损坏的 JPEG 仍被接受为 pending（worker 执行时才会失败）', async () => {
    const broken = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0x00, 0x00, 0x00, 0x00]).toString('base64')}`
    const res = await POST(req({ image: broken, style: 'anime' }))
    expect(res.status).toBe(201)
    const { jobId } = (await res.json()) as { jobId: string }
    const job = await prisma.posterJob.findUnique({ where: { id: jobId } })
    expect(job!.status).toBe('pending')
  })
})

describe('GET /api/poster/:jobId', () => {
  it('任务不存在时 404', async () => {
    const res = await getJob('00000000-0000-0000-0000-000000000000')
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: '任务不存在' })
  })

  it('能查到 pending 状态', async () => {
    const postRes = await POST(req({ image: await jpegDataUrl(), style: 'watercolor' }))
    const { jobId } = (await postRes.json()) as { jobId: string }

    const res = await getJob(jobId)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('pending')
    expect(body.resultImageUrl).toBeNull()
    expect(body.errorMessage).toBeNull()
  })
})
