import { hashPassword, signToken, COOKIE_NAME, requireAuth } from '../src/lib/auth.ts'
import { POST as avatarPost } from '../app/api/avatar/route.ts'

const token = await signToken({ userId: 'test-id', username: 'test' })
console.log('token:', token.slice(0, 30))

const req = new Request('http://localhost/api/avatar', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Cookie: `${COOKIE_NAME}=${token}`,
  },
  body: JSON.stringify({ name: 'x', baseId: 'x', parts: {} }),
})

// 测试 requireAuth
const ctx = await requireAuth(req)
console.log('requireAuth ok:', ctx)

const res = await avatarPost(req)
console.log('avatarPost status:', res.status)
console.log('avatarPost body:', await res.json())
