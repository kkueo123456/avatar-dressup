import { requireAuth, findUserById } from '@/lib/auth'

export const runtime = 'nodejs'

export async function GET(request: Request): Promise<Response> {
  try {
    const ctx = await requireAuth(request)
    const user = await findUserById(ctx.userId)
    return Response.json({ id: user.id, username: user.username })
  } catch (e) {
    const status = e instanceof Error && 'status' in e ? (e as { status: number }).status : 500
    const message = e instanceof Error ? e.message : '服务器错误'
    return Response.json({ error: message }, { status })
  }
}
