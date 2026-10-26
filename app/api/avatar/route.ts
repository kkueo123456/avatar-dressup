import { prisma } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'
import { validateParts } from '@/lib/partsValidation'
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
    if (!trimmedName || !baseId) {
      return jsonError('名称、底模和部件数据不能为空')
    }
    if (trimmedName.length > 20) {
      return jsonError('名称最多 20 个字符')
    }

    // parts 严格校验：必须是 Record<slotId, partId[]>，杜绝任意 JSON 入库
    const validParts = validateParts(parts)
    if (!validParts) {
      return jsonError('parts 格式非法：应为槽位到部件 ID 数组的映射')
    }

    const avatar = await prisma.avatar.create({
      data: {
        userId: ctx.userId,
        name: trimmedName,
        baseId,
        parts: JSON.stringify(validParts),
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

    // 进行中的海报任务（按形象分组）：前端据此显示「生成中」并启动轮询
    const activeJobs = await prisma.posterJob.findMany({
      where: { userId: ctx.userId, status: { in: ['pending', 'running'] }, avatarId: { not: null } },
      select: { avatarId: true },
    })
    const pendingAvatarIds = new Set(activeJobs.map((j) => j.avatarId as string))

    return Response.json({
      avatars: avatars.map((a) => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        posterPending: pendingAvatarIds.has(a.id),
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
