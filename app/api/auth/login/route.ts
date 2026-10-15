import { prisma } from '@/lib/db'
import { verifyPassword, signToken, setSessionCookie, validateUsername, validatePassword } from '@/lib/auth'

export const runtime = 'nodejs'

export async function POST(request: Request): Promise<Response> {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '请求格式错误' }, { status: 400 })
  }

  const { username, password } = body as { username?: string; password?: string }

  if (!username || !password) {
    return Response.json({ error: '用户名和密码不能为空' }, { status: 400 })
  }
  if (!validateUsername(username) || !validatePassword(password)) {
    return Response.json({ error: '用户名或密码格式不正确' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { username } })
  if (!user) {
    return Response.json({ error: '用户名或密码错误' }, { status: 401 })
  }

  const ok = await verifyPassword(password, user.passwordHash)
  if (!ok) {
    return Response.json({ error: '用户名或密码错误' }, { status: 401 })
  }

  const token = await signToken({ userId: user.id, username: user.username })
  await setSessionCookie(token)

  return Response.json({ id: user.id, username: user.username })
}
