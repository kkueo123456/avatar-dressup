import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { parsePosterRequest } from '@/poster/request'
import { MAX_IMAGE_BYTES } from '@/poster/types'
import { prisma } from '@/lib/db'
import { hashPassword, signToken, COOKIE_NAME } from '@/lib/auth'
import { resetRateLimits } from '@/lib/rateLimit'
import { POST } from '../app/api/poster/route'
import { GET } from '../app/api/poster/[jobId]/route'

vi.mock('@/poster/request', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/poster/request')>()
  return { ...actual, parsePosterRequest: vi.fn(actual.parsePosterRequest) }
})

const parseSpy = vi.mocked(parsePosterRequest)

let cookie = ''

beforeAll(async () => {
  // 确保测试数据库可连
  await prisma.$connect()
  // poster 接口现在需要登录：建测试用户并签发真实 JWT（与生产同路径）
  await prisma.user.deleteMany({ where: { username: 'poster_qa' } })
  const user = await prisma.user.create({
    data: { username: 'poster_qa', passwordHash: await hashPassword('123456') },
  })
  const token = await signToken({ userId: user.id, username: user.username })
  cookie = `${COOKIE_NAME}=${token}`
})

afterEach(async () => {
  parseSpy.mockClear()
  // 清理测试产生的 job
  await prisma.posterJob.deleteMany({
    where: { inputImageUrl: { startsWith: 'data:image/jpeg;base64,' } },
  })
})

beforeEach(() => {
  // 每个用例前清空限流计数，避免用例间通过限流状态互相干扰
  resetRateLimits()
})

function req(body: unknown, withAuth = true): Request {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (withAuth) headers['cookie'] = cookie
  return new Request('http://localhost/api/poster', {
    method: 'POST',
    headers,
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
  return {
    headers: new Headers({ 'content-length': String(contentLength), cookie }),
    body: stream,
  } as unknown as Request
}

// 生成一次，全部用例复用（本机负载高时 sharp 单次可达 1-2 秒，避免限流用例连跑 10 次 sharp 超时）
let cachedJpeg: string | null = null
async function jpegDataUrl(): Promise<string> {
  if (cachedJpeg) return cachedJpeg
  const sharp = (await import('sharp')).default
  const buf = await sharp({ create: { width: 64, height: 96, channels: 3, background: '#806050' } }).jpeg().toBuffer()
  cachedJpeg = `data:image/jpeg;base64,${buf.toString('base64')}`
  return cachedJpeg
}

async function getJob(jobId: string): Promise<ReturnType<typeof GET>> {
  return GET(new Request(`http://localhost/api/poster/${jobId}`), { params: Promise.resolve({ jobId }) })
}

describe('POST /api/poster 鉴权', () => {
  it('未登录提交 401', async () => {
    const res = await POST(req({ image: 'data:image/jpeg;base64,AAAA', style: 'anime' }, false))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('请先登录')
  })

  it('Cookie 无效（伪造 token）401', async () => {
    const res = await POST(
      new Request('http://localhost/api/poster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: `${COOKIE_NAME}=fake-token-value` },
        body: JSON.stringify({ image: 'data:image/jpeg;base64,AAAA', style: 'anime' }),
      })
    )
    expect(res.status).toBe(401)
  })
})

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

  it('格式合法时立刻返回 201 与 jobId，任务归属提交用户', async () => {
    const res = await POST(req({ image: await jpegDataUrl(), style: 'fantasy' }))
    expect(res.status).toBe(201)
    const body = (await res.json()) as { jobId: string }
    expect(typeof body.jobId).toBe('string')
    expect(body.jobId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)

    // 数据库里应为 pending，且记录了提交者
    const job = await prisma.posterJob.findUnique({ where: { id: body.jobId } })
    expect(job).not.toBeNull()
    expect(job!.status).toBe('pending')
    expect(job!.style).toBe('fantasy')
    expect(job!.userId).not.toBeNull()
    const owner = await prisma.user.findUnique({ where: { username: 'poster_qa' } })
    expect(job!.userId).toBe(owner!.id)
  })

  it('FF D8 开头但内容损坏的 JPEG 仍被接受为 pending（worker 执行时才会失败）', async () => {
    const broken = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0x00, 0x00, 0x00, 0x00]).toString('base64')}`
    const res = await POST(req({ image: broken, style: 'anime' }))
    expect(res.status).toBe(201)
    const { jobId } = (await res.json()) as { jobId: string }
    const job = await prisma.posterJob.findUnique({ where: { id: jobId } })
    expect(job!.status).toBe('pending')
  })

  it('同一用户高频提交触发限流 429', { timeout: 30_000 }, async () => {
    // 每用例前已 resetRateLimits；灌满 10 次配额（全部应成功）
    for (let i = 0; i < 10; i++) {
      const r = await POST(req({ image: await jpegDataUrl(), style: 'anime' }))
      expect(r.status, `第 ${i + 1} 次提交应成功`).toBe(201)
    }
    // 第 11 次应被限流
    const res = await POST(req({ image: await jpegDataUrl(), style: 'anime' }))
    expect(res.status).toBe(429)
    const body = await res.json()
    expect(body.error).toContain('提交过于频繁')
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
