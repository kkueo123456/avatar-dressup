import sharp from 'sharp'
import { POSTER_HEIGHT, POSTER_WIDTH, type PosterInput, type PosterProvider, type PosterStyle } from './types'

interface StyleParams {
  /** 色相偏移，度 */
  hue: number
  saturation: number
  brightness: number
  /** sharp 要求 1.0 到 3.0 */
  gamma: number
  /** 保留明度、替换色相的双色调染色 */
  tint: { r: number; g: number; b: number }
  band: string
  title: string
}

/** 四种风格各一套调色；标题栏只用英文，容器里不一定有中文字体 */
const STYLE_PARAMS: Record<PosterStyle, StyleParams> = {
  fantasy: { hue: -10, saturation: 1.15, brightness: 0.95, gamma: 1.1, tint: { r: 232, g: 180, b: 110 }, band: '#2B2416', title: 'FANTASY' },
  anime: { hue: 15, saturation: 1.45, brightness: 1.08, gamma: 1.0, tint: { r: 255, g: 196, b: 232 }, band: '#2A1A2E', title: 'ANIME' },
  watercolor: { hue: 0, saturation: 0.7, brightness: 1.12, gamma: 1.0, tint: { r: 222, g: 226, b: 240 }, band: '#1E2230', title: 'WATERCOLOR' },
  cyberpunk: { hue: 190, saturation: 1.5, brightness: 0.92, gamma: 1.25, tint: { r: 120, g: 220, b: 255 }, band: '#101A2A', title: 'CYBERPUNK' },
}

function bandSvg(p: StyleParams, date: string): Buffer {
  const h = 120
  const y = POSTER_HEIGHT - h
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}">` +
      `<rect x="0" y="${y}" width="${POSTER_WIDTH}" height="${h}" fill="${p.band}" fill-opacity="0.88"/>` +
      `<rect x="0" y="${y}" width="${POSTER_WIDTH}" height="2" fill="#E8A445"/>` +
      `<text x="40" y="${POSTER_HEIGHT - 48}" font-family="sans-serif" font-size="40" font-weight="700" letter-spacing="6" fill="#E8A445">${p.title}</text>` +
      `<text x="${POSTER_WIDTH - 40}" y="${POSTER_HEIGHT - 48}" font-family="sans-serif" font-size="22" text-anchor="end" fill="#A09DAE">AVATAR DRESSUP · ${date}</text>` +
      `</svg>`,
  )
}

/** 演示用假适配器：缩放、调色、双色调、底部标题栏。接口与真实服务相同。 */
export const mockProvider: PosterProvider = {
  id: 'mock',
  async generate({ image, style }: PosterInput): Promise<Buffer> {
    const p = STYLE_PARAMS[style]
    const date = new Date().toISOString().slice(0, 10)
    return sharp(image)
      .resize(POSTER_WIDTH, POSTER_HEIGHT, { fit: 'cover' })
      .modulate({ brightness: p.brightness, saturation: p.saturation, hue: p.hue })
      .gamma(p.gamma)
      .tint(p.tint)
      .composite([{ input: bandSvg(p, date), top: 0, left: 0 }])
      .jpeg({ quality: 85 })
      .toBuffer()
  },
}
