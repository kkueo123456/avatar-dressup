import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { parsePosterRequest } from '@/poster/request'
import { getPosterProvider } from '@/poster/index'
import { mockProvider } from '@/poster/mock'
import { POSTER_HEIGHT, POSTER_WIDTH } from '@/poster/types'

const PREFIX = 'data:image/jpeg;base64,'

async function jpegDataUrl(width = 64, height = 96): Promise<string> {
  const buf = await sharp({ create: { width, height, channels: 3, background: { r: 120, g: 80, b: 60 } } })
    .jpeg()
    .toBuffer()
  return PREFIX + buf.toString('base64')
}

describe('parsePosterRequest', () => {
  it('合法请求解析出 JPEG Buffer 与风格', async () => {
    const r = parsePosterRequest({ image: await jpegDataUrl(), style: 'anime' })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.input.style).toBe('anime')
      expect([r.input.image[0], r.input.image[1]]).toEqual([0xff, 0xd8])
    }
  })

  it('不是对象、不是 data URL、不是 JPEG 都报同一句', async () => {
    const msg = { ok: false, error: '图片必须是 JPEG data URL' }
    expect(parsePosterRequest(null)).toEqual(msg)
    expect(parsePosterRequest({ image: 'hello', style: 'anime' })).toEqual(msg)
    expect(parsePosterRequest({ image: 'data:image/png;base64,AAAA', style: 'anime' })).toEqual(msg)
    const notJpeg = PREFIX + Buffer.from('not a jpeg at all').toString('base64')
    expect(parsePosterRequest({ image: notJpeg, style: 'anime' })).toEqual(msg)
  })

  it('超过 4 MB 在解码前就拒绝', () => {
    const huge = PREFIX + 'A'.repeat(6 * 1024 * 1024)
    expect(parsePosterRequest({ image: huge, style: 'anime' })).toEqual({ ok: false, error: '图片超过 4 MB' })
  })

  it('未知风格', async () => {
    expect(parsePosterRequest({ image: await jpegDataUrl(), style: 'oil' })).toEqual({ ok: false, error: '未知风格' })
    expect(parsePosterRequest({ image: await jpegDataUrl() })).toEqual({ ok: false, error: '未知风格' })
  })
})

describe('getPosterProvider', () => {
  it('mock 返回假适配器', () => {
    expect(getPosterProvider({ POSTER_PROVIDER: 'mock' }).id).toBe('mock')
  })

  it('real 返回通义万相适配器', () => {
    expect(getPosterProvider({ POSTER_PROVIDER: 'real' }).id).toBe('real')
  })

  it('未设置或拼错时抛错并带上值，不静默回退', () => {
    expect(() => getPosterProvider({})).toThrow('海报服务未配置: POSTER_PROVIDER=')
    expect(() => getPosterProvider({ POSTER_PROVIDER: 'openai' })).toThrow('海报服务未配置: POSTER_PROVIDER=openai')
  })
})

describe('mockProvider', () => {
  it('四种风格都输出 768 乘 1152 的 JPEG，且彼此不同', async () => {
    const src = Buffer.from((await jpegDataUrl(300, 450)).slice(PREFIX.length), 'base64')
    const outs: string[] = []
    for (const style of ['fantasy', 'anime', 'watercolor', 'cyberpunk'] as const) {
      const out = await mockProvider.generate({ image: src, style })
      const meta = await sharp(out).metadata()
      expect(meta.format).toBe('jpeg')
      expect(meta.width).toBe(POSTER_WIDTH)
      expect(meta.height).toBe(POSTER_HEIGHT)
      outs.push(out.toString('base64'))
    }
    expect(new Set(outs).size).toBe(4)
  }, 20000)

  it('输入像素超过上限的 JPEG 在解码前就被拒绝', async () => {
    const big = await sharp({ create: { width: 3000, height: 3000, channels: 3, background: '#333333' } })
      .jpeg({ progressive: true })
      .toBuffer()
    await expect(mockProvider.generate({ image: big, style: 'anime' })).rejects.toThrow(/pixel limit/i)
  }, 20000)
})
