import { afterEach, describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { POST } from '../app/api/poster/route'

const original = process.env.POSTER_PROVIDER
afterEach(() => {
  if (original === undefined) delete process.env.POSTER_PROVIDER
  else process.env.POSTER_PROVIDER = original
})

function req(body: unknown): Request {
  return new Request('http://localhost/api/poster', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  })
}

async function jpegDataUrl(): Promise<string> {
  const buf = await sharp({ create: { width: 64, height: 96, channels: 3, background: '#806050' } }).jpeg().toBuffer()
  return `data:image/jpeg;base64,${buf.toString('base64')}`
}

describe('POST /api/poster', () => {
  it('请求体不是 JSON 时 400', async () => {
    process.env.POSTER_PROVIDER = 'mock'
    const res = await POST(req('not json'))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '图片必须是 JPEG data URL' })
  })

  it('校验失败时 400 带固定文案', async () => {
    process.env.POSTER_PROVIDER = 'mock'
    const res = await POST(req({ image: await jpegDataUrl(), style: 'oil' }))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: '未知风格' })
  })

  it('未配置适配器时 500 带说明', async () => {
    delete process.env.POSTER_PROVIDER
    const res = await POST(req({ image: await jpegDataUrl(), style: 'anime' }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('海报服务未配置: POSTER_PROVIDER=')
  })

  it('成功时返回 image/jpeg 且不缓存', async () => {
    process.env.POSTER_PROVIDER = 'mock'
    const res = await POST(req({ image: await jpegDataUrl(), style: 'fantasy' }))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('cache-control')).toBe('no-store')
    const buf = Buffer.from(await res.arrayBuffer())
    expect((await sharp(buf).metadata()).width).toBe(768)
  }, 20000)
})
