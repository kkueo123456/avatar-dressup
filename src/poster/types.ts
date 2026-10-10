export const POSTER_STYLES = ['fantasy', 'anime', 'watercolor', 'cyberpunk'] as const
export type PosterStyle = (typeof POSTER_STYLES)[number]

export const POSTER_STYLE_LABELS: Record<PosterStyle, string> = {
  fantasy: '奇幻插画',
  anime: '动漫',
  watercolor: '水彩',
  cyberpunk: '赛博朋克',
}

export const POSTER_WIDTH = 768
export const POSTER_HEIGHT = 1152
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024

export interface PosterInput {
  image: Buffer
  style: PosterStyle
}

/** 一个方法：收图出图。真实服务与假适配器都实现它。 */
export interface PosterProvider {
  readonly id: string
  generate(input: PosterInput): Promise<Buffer>
}

export function isPosterStyle(v: unknown): v is PosterStyle {
  return typeof v === 'string' && (POSTER_STYLES as readonly string[]).includes(v)
}
