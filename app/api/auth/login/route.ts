import { prisma } from '@/lib/db'
import { verifyPassword, signToken, setSessionCookie, validateUsername, validatePassword } from '@/lib/auth'
import { rateLimit, clientIp } from '@/lib/rateLimit'

export const runtime = 'nodejs'

export async function POST(request: Request): Promise<Response> {
  // 登录限流：同一 IP 每分钟最多 10 次，防暴破
  const rl = rateLimit(`login:${clientIp(request)}`, 10, 60_000)
  if (!rl.ok) {
    return Response.json({ error: `登录尝试过于频繁，请 ${rl.retryAfter} 秒后再试` }, {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfter) },
    })
  }

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
