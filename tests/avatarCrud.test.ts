import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { hashPassword, signToken, COOKIE_NAME } from '@/lib/auth'
import { POST as avatarPost, GET as avatarListGet } from '../app/api/avatar/route'
import { GET as avatarGet, PATCH as avatarPatch, DELETE as avatarDelete } from '../app/api/avatar/[id]/route'

vi.mock('next/headers', () => ({
  cookies: () => ({
    set: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(() => undefined),
  }),
}))

let testUserId = ''
let testToken = ''

beforeAll(async () => {
  await prisma.$connect()
  const user = await prisma.user.create({
    data: {
      username: 'avatar_test_user',
      passwordHash: await hashPassword('123456'),
    },
  })
  testUserId = user.id
  testToken = await signToken({ userId: user.id, username: user.username })
})

afterEach(async () => {
  await prisma.avatar.deleteMany({ where: { userId: testUserId } })
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { username: 'avatar_test_user' } })
})

function authReq(method: string, url: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `${COOKIE_NAME}=${testToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })
}

async function createAvatar(name = 'Test Avatar') {
  const res = await avatarPost(authReq('POST', 'http://localhost/api/avatar', {
    name,
    baseId: 'base_male',
    parts: { head: ['hair_01'], body: ['shirt_01'] },
  }))
  if (res.status !== 201) {
    const err = await res.json()
    throw new Error(`createAvatar failed: ${res.status} ${JSON.stringify(err)}`)
  }
  return (await res.json()) as { id: string }
}

describe('POST /api/avatar', () => {
  it('未登录 401', async () => {
    const res = await avatarPost(new Request('http://localhost/api/avatar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'x', baseId: 'x', parts: {} }),
    }))
    expect(res.status).toBe(401)
  })

  it('缺少字段 400', async () => {
    const res = await avatarPost(authReq('POST', 'http://localhost/api/avatar', { name: 'x' }))
    expect(res.status).toBe(400)
  })

  it('正常创建 201', async () => {
    const { id } = await createAvatar('我的形象')
    const avatar = await prisma.avatar.findUnique({ where: { id } })
    expect(avatar).not.toBeNull()
    expect(avatar!.name).toBe('我的形象')
    expect(avatar!.baseId).toBe('base_male')
    expect(JSON.parse(avatar!.parts)).toEqual({ head: ['hair_01'], body: ['shirt_01'] })
  })
})

describe('GET /api/avatar', () => {
  it('未登录 401', async () => {
    const res = await avatarListGet(new Request('http://localhost/api/avatar'))
    expect(res.status).toBe(401)
  })

  it('返回用户形象列表', async () => {
    await createAvatar('形象 A')
    await createAvatar('形象 B')
    const res = await avatarListGet(authReq('GET', 'http://localhost/api/avatar'))
    expect(res.status).toBe(200)
    const data = (await res.json()) as { avatars: Array<{ name: string }> }
    expect(data.avatars.length).toBe(2)
    expect(data.avatars[0].name).toBe('形象 B')
  })
})

describe('GET /api/avatar/[id]', () => {
  it('获取详情 200', async () => {
    const { id } = await createAvatar('详情测试')
    const res = await avatarGet(authReq('GET', `http://localhost/api/avatar/${id}`), { params: Promise.resolve({ id }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('详情测试')
    expect(data.parts).toEqual({ head: ['hair_01'], body: ['shirt_01'] })
  })

  it('不存在 404', async () => {
    const res = await avatarGet(authReq('GET', 'http://localhost/api/avatar/00000000-0000-0000-0000-000000000000'), { params: Promise.resolve({ id: '00000000-0000-0000-0000-000000000000' }) })
    expect(res.status).toBe(404)
  })
})

describe('PATCH /api/avatar/[id]', () => {
  it('重命名 200', async () => {
    const { id } = await createAvatar('旧名字')
    const res = await avatarPatch(authReq('PATCH', `http://localhost/api/avatar/${id}`, { name: '新名字' }), { params: Promise.resolve({ id }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.name).toBe('新名字')
  })

  it('更新封面 200', async () => {
    const { id } = await createAvatar()
    const res = await avatarPatch(authReq('PATCH', `http://localhost/api/avatar/${id}`, { coverUrl: 'data:image/jpeg;base64,xxx' }), { params: Promise.resolve({ id }) })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.coverUrl).toBe('data:image/jpeg;base64,xxx')
  })
})

describe('DELETE /api/avatar/[id]', () => {
  it('删除成功 200', async () => {
    const { id } = await createAvatar('要删除')
    const res = await avatarDelete(authReq('DELETE', `http://localhost/api/avatar/${id}`), { params: Promise.resolve({ id }) })
    expect(res.status).toBe(200)
    const avatar = await prisma.avatar.findUnique({ where: { id } })
    expect(avatar).toBeNull()
  })
})
