import { prisma } from '@/lib/db'
import { hashPassword, signToken, setSessionCookie, validateUsername, validatePassword } from '@/lib/auth'

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
  if (!validateUsername(username)) {
    return Response.json({ error: '用户名需 3-20 位字母数字下划线' }, { status: 400 })
  }
  if (!validatePassword(password)) {
    return Response.json({ error: '密码至少 6 位' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { username } })
  if (existing) {
    return Response.json({ error: '用户名已被注册' }, { status: 409 })
  }

  const passwordHash = await hashPassword(password)
  const user = await prisma.user.create({
    data: { username, passwordHash },
    select: { id: true, username: true },
  })

  const token = await signToken({ userId: user.id, username: user.username })
  await setSessionCookie(token)

  return Response.json({ id: user.id, username: user.username }, { status: 201 })
}
