import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { cookies, headers } from 'next/headers'
import { prisma } from './db'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'avatar-dressup-fallback-secret'
)

const SALT_ROUNDS = 10

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export interface TokenPayload {
  userId: string
  username: string
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ sub: payload.userId, username: payload.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET)
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  const { payload } = await jwtVerify(token, JWT_SECRET, { clockTolerance: 60 })
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Invalid token')
  }
  return {
    userId: payload.sub,
    username: typeof payload.username === 'string' ? payload.username : '',
  }
}

export const COOKIE_NAME = 'avatar_session'

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  const headerStore = await headers()
  // 只有 HTTPS 请求才设 Secure，否则 HTTP 直连（IP:3000）时浏览器不发送 Cookie
  const proto = headerStore.get('x-forwarded-proto') ?? 'http'
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: proto === 'https',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getSessionToken(): Promise<string | undefined> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value
}

export interface AuthContext {
  userId: string
  username: string
}

/** 从请求 cookie 中解析并验证 JWT，返回用户信息；未登录时抛 401 */
export async function requireAuth(request?: Request): Promise<AuthContext> {
  let token: string | undefined

  if (request) {
    const cookieHeader = request.headers.get('cookie') || ''
    const prefix = `${COOKIE_NAME}=`
    for (const part of cookieHeader.split(';')) {
      const c = part.trim()
      if (c.startsWith(prefix)) {
        token = decodeURIComponent(c.slice(prefix.length))
        break
      }
    }
  } else {
    token = await getSessionToken()
  }

  if (!token) {
    throw new AuthError('请先登录', 401)
  }
  try {
    const payload = await verifyToken(token)
    return { userId: payload.userId, username: payload.username }
  } catch {
    throw new AuthError('登录已过期，请重新登录', 401)
  }
}

export class AuthError extends Error {
  status: number
  constructor(message: string, status: number = 400) {
    super(message)
    this.status = status
  }
}

/** 校验用户名格式：3-20 位，字母数字下划线 */
export function validateUsername(username: string): boolean {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username)
}

/** 校验密码格式：至少 6 位 */
export function validatePassword(password: string): boolean {
  return password.length >= 6
}

/** 根据 userId 查用户，不存在时抛 404 */
export async function findUserById(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, username: true, createdAt: true },
  })
  if (!user) {
    throw new AuthError('用户不存在', 404)
  }
  return user
}
