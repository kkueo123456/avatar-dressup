import fs from 'node:fs'
import path from 'node:path'

/**
 * 海报图片静态服务：GET /posters/<filename>
 *
 * worker 把生成结果写到 data/posters/，DB 存短路径 /posters/<filename>，
 * 前端 <img src> 直接引用此路径。
 * 文件名白名单校验（[a-zA-Z0-9._-]），杜绝路径穿越。
 */
export const runtime = 'nodejs'

const POSTER_DIR = path.join(process.cwd(), 'data', 'posters')

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
): Promise<Response> {
  const { file } = await params

  // 文件名白名单：worker 生成的文件名只含 时间戳-随机串.jpg
  if (!/^[A-Za-z0-9._-]+$/.test(file)) {
    return new Response('Not Found', { status: 404 })
  }

  const filePath = path.join(POSTER_DIR, file)
  // 二次防御：解析后必须仍在 POSTER_DIR 内
  if (!path.resolve(filePath).startsWith(path.resolve(POSTER_DIR) + path.sep)) {
    return new Response('Not Found', { status: 404 })
  }

  try {
    const buf = fs.readFileSync(filePath)
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable', // 文件名含随机串，内容不可变
      },
    })
  } catch {
    return new Response('Not Found', { status: 404 })
  }
}
