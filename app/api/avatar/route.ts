import { prisma } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import type { AvatarState } from '@/avatar/slotRules'

export const runtime = 'nodejs'

function jsonError(message: string, status: number = 400): Response {
  return Response.json({ error: message }, { status })
}

/** POST /api/avatar - 保存形象 */
export async function POST(request: Request): Promise<Response> {
  try {
    const ctx = await requireAuth(request)
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonError('请求格式错误')
    }

    const { name, baseId, parts, coverUrl } = body as {
      name?: string
      baseId?: string
      parts?: AvatarState['equipped']
      coverUrl?: string
    }

    const trimmedName = typeof name === 'string' ? name.trim() : ''
    if (!trimmedName || !baseId || !parts) {
      return jsonError('名称、底模和部件数据不能为空')
    }
    if (trimmedName.length > 20) {
      return jsonError('名称最多 20 个字符')
    }

    const avatar = await prisma.avatar.create({
      data: {
        userId: ctx.userId,
        name: trimmedName,
        baseId,
        parts: JSON.stringify(parts),
        coverUrl: coverUrl || null,
      },
    })

    return Response.json({ id: avatar.id }, { status: 201 })
  } catch (e) {
    if (e instanceof AuthError) {
      return jsonError(e.message, e.status)
    }
    console.error('POST /api/avatar error:', e)
    const msg = e instanceof Error ? e.message : String(e)
    return jsonError(`服务器错误: ${msg}`, 500)
  }
}

/** GET /api/avatar - 列表 */
export async function GET(request: Request): Promise<Response> {
  try {
    const ctx = await requireAuth(request)
    const avatars = await prisma.avatar.findMany({
      where: { userId: ctx.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        baseId: true,
        coverUrl: true,
        posterUrl: true,
        createdAt: true,
        updatedAt: true,
        mintStatus: true,
        tokenId: true,
        chainId: true,
      },
    })

    return Response.json({
      avatars: avatars.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
      })),
    })
  } catch (e) {
    if (e instanceof AuthError) {
      return jsonError(e.message, e.status)
    }
    console.error('GET /api/avatar error:', e)
    return jsonError('服务器错误', 500)
  }
}
