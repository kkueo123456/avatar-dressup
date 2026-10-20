import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { POST as registerPost } from '../app/api/auth/register/route'
import { POST as loginPost } from '../app/api/auth/login/route'
import { POST as logoutPost } from '../app/api/auth/logout/route'
import { GET as meGet } from '../app/api/auth/me/route'

vi.mock('next/headers', () => ({
  cookies: () => ({
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(() => undefined),
  }),
  headers: () => ({
    get: vi.fn(() => 'http'),
  }),
}))

beforeAll(async () => {
  await prisma.$connect()
})

afterEach(async () => {
  await prisma.user.deleteMany({ where: { username: { startsWith: 'test_' } } })
})

function uniq(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}`
}

let reqSeq = 0
function jsonReq(body: unknown): Request {
  // 每个请求独立 IP，避免触发注册/登录限流（限流按 IP 计数）
  reqSeq += 1
  return new Request('http://localhost/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-forwarded-for': `10.0.0.${reqSeq}` },
    body: JSON.stringify(body),
  })
}

describe('POST /api/auth/register', () => {
  it('空用户名或密码 400', async () => {
    const res = await registerPost(jsonReq({}))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('用户名和密码不能为空')
  })

  it('用户名太短 400', async () => {
    const res = await registerPost(jsonReq({ username: 'ab', password: '123456' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('用户名需 3-20 位字母数字下划线')
  })

  it('密码太短 400', async () => {
    const res = await registerPost(jsonReq({ username: uniq('test'), password: '123' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('密码至少 6 位')
  })

  it('正常注册 201', async () => {
    const username = uniq('test_reg')
    const res = await registerPost(jsonReq({ username, password: '123456' }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.username).toBe(username)
    expect(typeof data.id).toBe('string')
    const user = await prisma.user.findUnique({ where: { username } })
    expect(user).not.toBeNull()
  })

  it('重复用户名 409', async () => {
    const username = uniq('test_dup')
    await registerPost(jsonReq({ username, password: '123456' }))
    const res = await registerPost(jsonReq({ username, password: '123456' }))
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('用户名已被注册')
  })
})

describe('POST /api/auth/login', () => {
  it('错误密码 401', async () => {
    const username = uniq('test_login')
    await registerPost(jsonReq({ username, password: 'correct_password' }))
    const res = await loginPost(jsonReq({ username, password: 'wrong_password' }))
    expect(res.status).toBe(401)
    expect((await res.json()).error).toBe('用户名或密码错误')
  })

  it('不存在的用户 401', async () => {
    const res = await loginPost(jsonReq({ username: uniq('test_nobody'), password: '123456' }))
    expect(res.status).toBe(401)
  })

  it('正确登录 200', async () => {
    const username = uniq('test_login_ok')
    await registerPost(jsonReq({ username, password: '123456' }))
    const res = await loginPost(jsonReq({ username, password: '123456' }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.username).toBe(username)
  })
})

describe('GET /api/auth/me', () => {
  it('未登录 401', async () => {
    const res = await meGet(new Request('http://localhost/api/auth/me'))
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('登出 200', async () => {
    const res = await logoutPost()
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })
})
