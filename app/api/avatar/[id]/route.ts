import { prisma } from '@/lib/db'
import { requireAuth, AuthError } from '@/lib/auth'

export const runtime = 'nodejs'

function jsonError(message: string, status: number = 400): Response {
  return Response.json({ error: message }, { status })
}

/** parts 存的是 JSON 字符串，历史数据可能损坏，损坏时返回空装备而不是抛 500 */
function safeParseParts(raw: string): Record<string, string[]> {
  try {
    const parsed = JSON.parse(raw) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, string[]>) : {}
  } catch {
    return {}
  }
}

interface Params {
  params: Promise<{ id: string }>
}

/** GET /api/avatar/[id] - 详情 */
export async function GET(request: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

    const avatar = await prisma.avatar.findUnique({ where: { id } })
    if (!avatar) {
      return jsonError('形象不存在', 404)
    }
    if (avatar.userId !== ctx.userId) {
      return jsonError('无权访问', 403)
    }

    return Response.json({
      id: avatar.id,
      name: avatar.name,
      baseId: avatar.baseId,
      parts: safeParseParts(avatar.parts),
      coverUrl: avatar.coverUrl,
      posterUrl: avatar.posterUrl,
      createdAt: avatar.createdAt.toISOString(),
      updatedAt: avatar.updatedAt.toISOString(),
      mintStatus: avatar.mintStatus,
      tokenId: avatar.tokenId,
      chainId: avatar.chainId,
      contractAddress: avatar.contractAddress,
      ownerWallet: avatar.ownerWallet,
      metadataUri: avatar.metadataUri,
    })
  } catch (e) {
    if (e instanceof AuthError) {
      return jsonError(e.message, e.status)
    }
    console.error('GET /api/avatar/[id] error:', e)
    return jsonError('服务器错误', 500)
  }
}

/** PATCH /api/avatar/[id] - 更新（重命名、封面、Web3 字段） */
export async function PATCH(request: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

    const avatar = await prisma.avatar.findUnique({ where: { id } })
    if (!avatar) {
      return jsonError('形象不存在', 404)
    }
    if (avatar.userId !== ctx.userId) {
      return jsonError('无权访问', 403)
    }

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return jsonError('请求格式错误')
    }

    const { name, coverUrl, posterUrl, mintStatus, tokenId, chainId, contractAddress, ownerWallet, metadataUri } =
      body as {
        name?: string
        coverUrl?: string | null
        posterUrl?: string | null
        mintStatus?: string
        tokenId?: string
        chainId?: number
        contractAddress?: string
        ownerWallet?: string
        metadataUri?: string
      }

    const data: Record<string, unknown> = {}
    if (name !== undefined) {
      const trimmedName = typeof name === 'string' ? name.trim() : ''
      if (!trimmedName) {
        return jsonError('名称不能为空')
      }
      if (trimmedName.length > 20) {
        return jsonError('名称最多 20 个字符')
      }
      data.name = trimmedName
    }
    if (coverUrl !== undefined) data.coverUrl = coverUrl
    if (posterUrl !== undefined) data.posterUrl = posterUrl
    if (mintStatus !== undefined) {
      if (!['UNMINTED', 'MINTING', 'MINTED'].includes(mintStatus)) {
        return jsonError('mintStatus 取值非法')
      }
      data.mintStatus = mintStatus
    }
    if (tokenId !== undefined) data.tokenId = tokenId
    if (chainId !== undefined) data.chainId = chainId
    if (contractAddress !== undefined) data.contractAddress = contractAddress
    if (ownerWallet !== undefined) data.ownerWallet = ownerWallet
    if (metadataUri !== undefined) data.metadataUri = metadataUri

    const updated = await prisma.avatar.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        coverUrl: true,
        updatedAt: true,
        mintStatus: true,
        tokenId: true,
      },
    })

    return Response.json({
      ...updated,
      updatedAt: updated.updatedAt.toISOString(),
    })
  } catch (e) {
    if (e instanceof AuthError) {
      return jsonError(e.message, e.status)
    }
    console.error('PATCH /api/avatar/[id] error:', e)
    return jsonError('服务器错误', 500)
  }
}

/** DELETE /api/avatar/[id] - 删除 */
export async function DELETE(request: Request, { params }: Params): Promise<Response> {
  try {
    const ctx = await requireAuth(request)
    const { id } = await params

    const avatar = await prisma.avatar.findUnique({ where: { id } })
    if (!avatar) {
      return jsonError('形象不存在', 404)
    }
    if (avatar.userId !== ctx.userId) {
      return jsonError('无权访问', 403)
    }

    await prisma.avatar.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (e) {
    if (e instanceof AuthError) {
      return jsonError(e.message, e.status)
    }
    console.error('DELETE /api/avatar/[id] error:', e)
    return jsonError('服务器错误', 500)
  }
}
