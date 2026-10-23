# Avatar Dressup 后端详解 —— 从小白到面试

> 本文档面向**后端初学者**，把这套项目的后端从「整体架构」到「每个优化点」「每个坑」讲透，兼顾面试。
> 阅读建议：按顺序读，每一章都先讲「为什么」，再讲「怎么做的」，最后给「面试话术」。

---

## 目录

1. [整体架构：这个后端长什么样](#1-整体架构)
2. [技术栈清单](#2-技术栈清单)
3. [数据模型：三张表](#3-数据模型)
4. [认证体系：登录/注册/会话](#4-认证体系)
5. [权限控制：资源级鉴权](#5-权限控制)
6. [数据校验：为什么不能信任前端](#6-数据校验)
7. [异步任务：海报生成](#7-异步任务)
8. [限流：防刷与防爆破](#8-限流)
9. [性能优化详解（重点）](#9-性能优化详解)
10. [坑位记录（血泪教训）](#10-坑位记录)
11. [面试高频问答](#11-面试高频问答)
12. [进阶方向（加分项）](#12-进阶方向)

---

## 1. 整体架构

### 1.1 一句话概括

> 这是一个 **Next.js 全栈项目**，前端是 3D 换装，后端提供**用户认证 + 形象数据增删改查 + 海报异步生成**三大能力。

### 1.2 分层结构

```
请求进来
   │
   ▼
┌─────────────────────────────┐
│  App Router 路由层 (route.ts) │   ← 8 个 API 接口
├─────────────────────────────┤
│  业务逻辑层 (lib / poster)    │   ← 认证、校验、限流、海报处理
├─────────────────────────────┤
│  ORM 层 (Prisma Client)      │   ← 和数据库打交道
├─────────────────────────────┤
│  数据库 (PostgreSQL)         │   ← 3 张表
└─────────────────────────────┘
```

### 1.3 所有 API 接口一览

| 方法 | 路径 | 作用 | 鉴权 | 限流 |
|------|------|------|------|------|
| POST | `/api/auth/register` | 注册 | 无 | IP 每分钟 5 次 |
| POST | `/api/auth/login` | 登录 | 无 | IP 每分钟 10 次 |
| POST | `/api/auth/logout` | 登出 | 无 | - |
| GET | `/api/auth/me` | 查当前用户 | JWT | - |
| GET | `/api/avatar` | 形象列表 | JWT | - |
| POST | `/api/avatar` | 保存形象 | JWT | - |
| GET | `/api/avatar/[id]` | 形象详情 | JWT | - |
| PATCH | `/api/avatar/[id]` | 更新形象 | JWT | - |
| DELETE | `/api/avatar/[id]` | 删除形象 | JWT | - |
| POST | `/api/poster` | 提交海报任务 | JWT | 用户+IP 每分钟 10 次 |
| GET | `/api/poster/[jobId]` | 查询海报结果 | 无 | - |

---

## 2. 技术栈清单

| 类别 | 技术 | 作用 | 为什么选它 |
|------|------|------|-----------|
| 框架 | Next.js 16 (App Router) | 全栈框架 | 前后端一体，路由即 API |
| 语言 | TypeScript | 类型安全 | 编译期发现错误 |
| ORM | Prisma 5 | 数据库访问 | 类型安全、迁移方便 |
| 数据库 | PostgreSQL | 存储 | JSON + UUID 支持好 |
| 密码 | bcryptjs | 密码哈希 | 单向加密，防泄露 |
| 会话 | jose (JWT) | 令牌签发/验证 | 无状态鉴权 |
| 图片 | sharp | 海报处理 | 高性能图片库 |

---

## 3. 数据模型

数据库用的是 **PostgreSQL**，通过 Prisma 管理。共 **3 张表**。

### 3.1 三张表关系图

```
users (用户) 1 ────┬──── N avatars (换装形象)
                   └──── N poster_jobs (海报任务)

外键都是 onDelete: Cascade（删用户 → 自动删他名下所有数据）
```

### 3.2 users 表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键，`@default(uuid())` 自动生成 |
| username | String | 用户名，`@unique` 唯一 |
| passwordHash | String | 密码哈希（**绝不存明文**） |
| createdAt | DateTime | 创建时间 |

### 3.3 avatars 表（核心表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| userId | String | 外键 → users.id |
| name | String | 形象名称 |
| baseId | String | 底模 ID |
| parts | String | **JSON 字符串**，存换装配置 |
| coverUrl / posterUrl | String? | 封面/海报图 |
| tokenId / mintStatus / chainId / contractAddress / ownerWallet / metadataUri | 各种 | **Web3 NFT 预留字段** |

> **`parts` 字段为什么用 `String` 存 JSON？**
> Prisma 的 String 类型直接存 JSON 字符串，序列化/反序列化由代码控制。这是本项目的取舍（更严谨做法是用 PG 的 `@db.JsonB`，能直接在 SQL 里查 JSON 内部）。

### 3.4 poster_jobs 表（异步任务）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | UUID | 主键 |
| style | String | 海报风格 |
| status | String | **状态机**：pending→running→done/failed |
| inputImageUrl | String | 输入图 |
| resultImageUrl | String? | 输出图 |
| errorMessage | String? | 失败原因 |
| userId | String? | 提交者 |
| startedAt / finishedAt | DateTime? | 开始/结束时间 |

---

## 4. 认证体系

这是后端最核心的部分，分**密码存储**和**会话管理**两块。

### 4.1 密码为什么不能存明文？

如果数据库被拖库，存明文密码 = 所有用户密码直接泄露。正确做法是存**哈希**：

```
明文密码 "123456"
   │  bcrypt.hash(密码, 10)
   ▼
哈希值 "$2a$10$N9qo8uLOickgx2ZMRZoMye..."  ← 存这个
```

**关键特性**：
- **单向**：只能从明文算哈希，不能从哈希反推明文
- **加盐（salt）**：同样的密码，每次哈希结果不同，防止彩虹表攻击
- **`SALT_ROUNDS = 10`**：bcrypt 的「成本因子」，越大越安全但越慢。10 是业界常用平衡值。

**代码位置**：`src/lib/auth.ts` 的 `hashPassword` / `verifyPassword`

```js
export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, SALT_ROUNDS)   // 注册时存哈希
}
export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash)       // 登录时比对
}
```

### 4.2 会话是怎么工作的？（JWT）

登录成功后，服务器怎么「记住」你是谁？这里用的是 **JWT（JSON Web Token）**。

#### 什么是 JWT？

JWT 就是一张**防伪的通行证**，三段用 `.` 连接：

```
Header.Payload.Signature
  头部.  载荷.    签名
```

- **Header**：说明用什么算法（HS256）
- **Payload**：装了 `userId`、`username` 等信息
- **Signature**：用密钥对前两段加密生成的**签名**，防止别人篡改

#### 核心原理：无状态鉴权

```
登录：服务器用密钥签发 token → 存到浏览器的 Cookie 里
之后每个请求：浏览器自动带上 Cookie → 服务器用同一密钥验证签名 → 通过就放行
```

**关键点**：服务器**不需要存储** session（所以叫「无状态」），只要密钥没泄露，签名就验得过去。这正是它和传统「session 存内存/Redis」的区别。

#### 代码位置：`src/lib/auth.ts`

```js
// 签发：有效期 7 天
export async function signToken(payload) {
  return new SignJWT({ sub: payload.userId, username: payload.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')          // 7 天过期
    .sign(getJwtSecret())
}

// 验证
export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, getJwtSecret(), { clockTolerance: 60 })
  ...
}
```

### 4.3 Cookie 的安全属性

token 存在 Cookie 里，但必须加**安全属性**（`setSessionCookie`）：

```js
cookieStore.set(COOKIE_NAME, token, {
  httpOnly: true,          // JS 读不到，防 XSS 窃取
  secure: proto === 'https', // HTTPS 才发，防明文传输
  sameSite: 'lax',          // 防 CSRF
  maxAge: 60 * 60 * 24 * 7, // 7 天
  path: '/',
})
```

三个属性的含义（**面试必考**）：

| 属性 | 作用 | 防什么攻击 |
|------|------|-----------|
| `httpOnly` | 禁止 JS 读取 cookie | XSS（跨站脚本） |
| `secure` | 只在 HTTPS 传输 | 中间人窃听 |
| `sameSite` | 限制跨站发送 | CSRF（跨站请求伪造） |

> ⚠️ **坑**：`secure` 属性不能无脑设 `true`。本项目里做了判断——只有 `x-forwarded-proto === 'https'` 才设，否则本地 HTTP 直连（IP:3000）时浏览器不会回传 Cookie，导致登录后永远「未登录」。

### 4.4 JWT 密钥的坑（血泪教训）

```js
function getJwtSecret() {
  const secret = process.env.JWT_SECRET
  if ((!secret || secret.length < 16) && process.env.NODE_ENV === 'production') {
    throw new Error('生产环境必须配置 JWT_SECRET（至少 16 字符）')
  }
  return new TextEncoder().encode(secret ?? 'avatar-dressup-dev-secret')
}
```

**两个关键点**：
1. **生产环境不配置密钥 = 致命**。如果静默回退到写死的默认值，任何知道源码的人都能伪造 token 冒充任意用户。
2. **懒校验**：不能在模块顶层 `throw`。因为 `next build` 阶段 `NODE_ENV` 已经是 `production`，但那时只是静态分析、不处理请求，如果顶层抛错会 build 失败。所以改成**首次真正签发/验证 token 时才检查**。

---

## 5. 权限控制

### 5.1 两层鉴权

```
第一层：requireAuth —— 你有没有登录？（401）
第二层：资源归属校验 —— 这个资源是不是你的？（403）
```

### 5.2 第一层：`requireAuth`

```js
export async function requireAuth(request) {
  // 从 cookie 里取 token → 验证 → 返回 userId
  // 没有 token 或验证失败 → 抛 AuthError('请先登录', 401)
}
```

### 5.3 第二层：水平越权防护（重点）

看 `GET /api/avatar/[id]`：

```js
const avatar = await prisma.avatar.findUnique({ where: { id } })
if (!avatar) return jsonError('形象不存在', 404)
if (avatar.userId !== ctx.userId) return jsonError('无权访问', 403)  // ← 关键
```

**为什么这行很重要？**

假设没有这行，用户 A 拿到用户 B 的形象 ID，就能直接访问/修改/删除 B 的数据——这叫**水平越权（IDOR，不安全的直接对象引用）**，是 OWASP 十大安全漏洞之一。

**面试话术**：
> 我在所有资源型接口（详情/更新/删除）都做了「资源归属校验」，先查记录再比对 `avatar.userId === 当前用户 id`，不一致返回 403 而非 404。返回 403 是为了明确告诉调用方「这个资源存在但不是你的」，避免信息泄露（返回 404 反而可能被用来探测资源是否存在）。

---

## 6. 数据校验

### 6.1 核心原则：永远不要信任前端

前端可以传任何脏数据（字符串、嵌套对象、数字数组、超长内容），如果直接入库，会导致：
- 数据库脏数据
- 前端读回来 `undefined` 行为
- 潜在注入/内存问题

### 6.2 `validateParts` 严格校验（写路径）

`parts` 的合法结构是 `Record<slotId, partId[]>`。`src/lib/partsValidation.ts` 做了多层防御：

```js
export function validateParts(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null  // 不是对象拒绝
  // 上限防护（防恶意超大 JSON）：
  const MAX_SLOTS = 64          // 槽位最多 64 个
  const MAX_IDS_PER_SLOT = 32   // 每槽最多 32 个部件
  const MAX_ID_LENGTH = 128     // 每个 ID 最长 128 字符
  // 逐个字段类型校验 + 长度校验
  // 规范化：去重（保持顺序）
  result[slotId] = [...new Set(value)]
}
```

**面试话术**：写路径用白名单式严格校验，非法直接 400；同时设置数量/长度上限，防止攻击者用超大 JSON 拖垮解析。

### 6.3 `safeParseParts` 容错解析（读路径）

```js
function safeParseParts(raw) {
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}   // 历史脏数据返回空，而不是抛 500
  }
}
```

**为什么读路径要容错？** 历史上曾有一段时期 POST 零校验，导致库里已有脏数据。如果读路径严格解析，遇到脏数据就 500。所以**读路径容错（坏数据返回空）、写路径严格（新数据保证干净）**——这是「消化历史 + 保证未来」的组合拳。

---

## 7. 异步任务

### 7.1 为什么海报不能同步做？

海报生成要调 AI/图片处理，耗时可能几秒到几十秒。如果同步做，HTTP 请求会一直挂着，用户体验极差，还会占满服务器连接。

### 7.2 异步任务的设计模式

```
POST /api/poster
   1. 校验 → 2. 落库(status=pending) → 3. 立即返回 jobId (201)
                                          │
                                          ▼
GET /api/poster/[jobId]  ← 前端轮询这个接口查状态
   返回 status: pending / running / done / failed
```

**这是典型的「任务队列」思想**：提交任务先入队（落库），立即返回任务 ID，处理在后台进行，客户端轮询查结果。

### 7.3 状态机

```
pending ──→ running ──→ done
   │            │
   └────────────┴──→ failed
```

### 7.4 适配器模式（Provider）

`src/poster/types.ts` 定义了一个接口：

```js
export interface PosterProvider {
  readonly id: string
  generate(input: PosterInput): Promise<Buffer>  // 收图出图
}
```

`src/poster/index.ts` 按环境变量选实现：

```js
export function getPosterProvider(env = process.env) {
  const id = env.POSTER_PROVIDER ?? ''
  if (id === 'mock') return mockProvider
  throw new Error(`海报服务未配置: POSTER_PROVIDER=${id}`)  // 不认识的值直接抛错，不静默回退
}
```

**设计亮点**：真实 AI 服务和演示用的 mock 实现同一个接口，切换只需改环境变量。**关键原则：不认识的配置值直接抛错，绝不静默回退到假的**（否则生产环境可能悄悄用了 mock）。

---

## 8. 限流

### 8.1 为什么要限流？

| 场景 | 不限制的后果 |
|------|-------------|
| 恶意注册 | 数据库被垃圾账号灌满 |
| 暴力破解登录 | 密码被穷举试出 |
| 刷海报任务 | 耗资源 + DB 膨胀 |

### 8.2 本项目三处限流

| 接口 | 维度 | 阈值 |
|------|------|------|
| 注册 | 按 IP | 每分钟 5 次 |
| 登录 | 按 IP | 每分钟 10 次（防暴破） |
| 海报 | 按 用户ID+IP | 每分钟 10 次 |

### 8.3 实现原理：滑动窗口（`src/lib/rateLimit.ts`）

核心数据结构是一个内存 Map：

```js
const buckets = new Map<string, { count: number; resetAt: number }>()
```

逻辑：
1. 查 key 有没有桶，没有就新建（count=1，resetAt = now + 窗口）
2. 有桶且没过期，count++
3. count 超过 max → 返回 `ok:false` + `retryAfter`

**关键细节**：定时清理过期桶（`CLEANUP_INTERVAL_MS = 60_000`），否则低流量下过期桶永不释放，内存泄漏。

### 8.4 限流的局限（面试加分点）

> ⚠️ 这个限流是**进程内**的（内存 Map），只在**单进程部署**下正确。如果多实例/多机部署，每个进程各算各的，上限会被放大 N 倍。生产多实例要换 **Redis** 做集中式计数。

---

## 9. 性能优化详解

### 9.1 索引（Index）—— 解决「查数据慢」

**问题**：100 万行数据的表，`where userId = xxx` 没有索引要全表扫描。

**原理**：索引像书的目录，按字段建一张排序好的对照表，查询时直接定位，不用扫全表。

**本项目的复合索引**（`schema.prisma`）：

```prisma
model Avatar {
  @@index([userId, createdAt])   // 用户列表按时间倒序
}
model PosterJob {
  @@index([status, createdAt])   // 调度器拉待处理任务
  @@index([userId, createdAt])   // 查用户自己的任务
}
```

**为什么用「复合索引」？** 因为列表查询是「先按 userId 过滤，再按 createdAt 排序」，两个字段一起用，建在一个索引里最高效。

### 9.2 Prisma 单例 —— 解决「连接太多」

**问题**：每 `new PrismaClient()` 就开一条数据库连接。Next.js 开发热重载会反复重新执行模块，导致连接越建越多，最终撑爆数据库连接上限。

**解决**（`src/lib/db.ts`）：

```js
const globalForPrisma = globalThis
export const prisma = globalForPrisma.prisma ?? new PrismaClient()
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma   // 挂到 global，热重载复用
}
```

保证**整个进程只有一个 PrismaClient 实例**（也就只有一个连接池）。

### 9.3 `select` 精简字段 —— 解决「查了用不到的数据」

列表接口只查需要的字段，不查 `parts` 这种大 JSON：

```js
prisma.avatar.findMany({
  where: { userId },
  orderBy: { createdAt: 'desc' },
  select: { id: true, name: true, coverUrl: true, ... }  // 故意不查 parts
})
```

好处：网络传输变小 + 数据库 IO 减少。原则：**列表精简、详情完整**。

### 9.4 请求体大小限制 —— 解决「超大请求拖垮内存」

海报接口上传图片，做了**双重防护**（`readBodyText`）：

```js
// 第一重：先看 content-length，声明超了直接拒，连 body 都不读
const declared = Number(request.headers.get('content-length'))
if (declared > MAX_BODY_BYTES) return null

// 第二重：边读边累加，超了主动 cancel
if (total > MAX_BODY_BYTES) { await reader.cancel(); return null }
```

### 9.5 图片解码前预检 —— 解决「像素炸弹」

`src/poster/mock.ts` 里：

```js
const MAX_INPUT_PIXELS = 2048 * 3072
sharp(image, { limitInputPixels: MAX_INPUT_PIXELS })
```

**坑**：一张几百 KB 的渐进式 JPEG 可以在文件头声明 `16000×16000` 像素，解码时会撑爆内存（0.5GB）。所以要在**解码前**按文件头尺寸拒绝。

### 9.6 限制线程池 —— 适配小容器

```js
sharp.concurrency(1)  // 0.25 核容器上别让 libvips 按宿主机 CPU 数开线程池
```

---

## 10. 坑位记录（血泪教训）

| # | 坑 | 后果 | 修复 |
|---|----|------|------|
| 1 | JWT 密钥静默回退默认值 | 任何人可伪造 token | 生产缺失即抛错 + 懒校验 |
| 2 | Cookie `secure` 无脑设 true | 本地 HTTP 登录后永远「未登录」 | 按 x-forwarded-proto 判断 |
| 3 | parts 字段零校验 | 任意 JSON 入库成脏数据 | 写路径严格校验 + 读路径容错 |
| 4 | Prisma 热重载反复 new | 连接泄漏撑爆 DB | globalThis 单例 |
| 5 | 限流桶不清理 | 内存泄漏 | 定时清理过期桶 |
| 6 | 限流用进程内内存 | 多实例上限被放大 | 生产换 Redis |
| 7 | 图片不设像素上限 | 解码内存爆炸 | 解码前 limitInputPixels |
| 8 | POSTER_PROVIDER 静默回退 mock | 生产悄悄用假服务 | 不认识值直接抛错 |
| 9 | 水平越权没校验 | 用户可访问他人数据 | 资源归属校验 403 |

---

## 11. 面试高频问答

### Q1：介绍下这个项目的后端？
> 技术栈是 Next.js 16 + TypeScript + Prisma + PostgreSQL。三张表：users、avatars、poster_jobs。提供用户认证、形象 CRUD、海报异步生成三块能力。认证用 JWT + bcrypt，做了资源级权限校验、数据严格校验、接口限流和多项性能优化。

### Q2：为什么选 PostgreSQL 而不是 MySQL？
> 因为要存 JSON 化换装配置（parts 字段），PG 的 JSONB 支持更好；主键用 UUID，PG 对 UUID 是原生一等公民，MySQL 的 UUID 主键有页分裂性能坑；PG 的 MVCC 并发控制更强。

### Q3：JWT 和 Session 的区别？
> JWT 是无状态的，服务器不存 session，靠密钥验签；优点是扩展性好（多实例无需共享存储）、适合分布式；缺点是没法主动失效（只能等过期）。Session 相反，服务器存状态，能主动踢人，但多实例要共享存储（Redis）。

### Q4：怎么防止水平越权？
> 资源型接口先查记录，再比对 `record.userId === 当前用户id`，不一致返回 403。返回 403 而非 404 是为了不泄露资源存在性。

### Q5：密码怎么存的？
> bcrypt 哈希，成本因子 10，带盐。绝不存明文。登录用 `bcrypt.compare` 比对。

### Q6：异步任务怎么做的？
> 提交时先落库（status=pending）立即返回 jobId，后台处理，前端轮询查状态。当前是 DB 轮询，量大可升级 Redis + 消息队列（BullMQ）+ 独立 worker。

### Q7：限流怎么实现的？
> 进程内滑动窗口，按 key（IP 或 用户+IP）计数，超阈值返回 429 + Retry-After。局限是单进程有效，多实例要换 Redis。

### Q8：Cookie 三个安全属性？
> httpOnly 防 XSS、secure 防窃听、sameSite 防 CSRF。

### Q9：Prisma 有什么优化？
> 单例模式防连接泄漏、select 精简字段、复合索引、连接池管理。

### Q10：如果用户量上来了怎么扩展？
> 数据库加索引/读写分离/分库分表；缓存层加 Redis；限流和 session 迁到 Redis；异步任务上消息队列 + 独立 worker；CDN 托管静态资源和海报图；无状态化以便水平扩容。

---

## 12. 进阶方向（加分项）

这些是目前项目**还没做**但面试可以主动提的升级方向：

1. **异步任务升级**：DB 轮询 → Redis/BullMQ 消息队列 + 独立 worker 进程
2. **限流/session 集中化**：进程内内存 → Redis（支持多实例水平扩容）
3. **parts 字段**：String 存 JSON → PG 的 `@db.JsonB`（可索引、可 SQL 查询）
4. **对象存储**：海报图当前存本地/URL → 迁移到 S3/OSS + CDN
5. **日志与监控**：接入结构化日志 + 错误追踪（Sentry）+ 指标监控
6. **API 版本化**：`/api/v1/...` 便于后续演进
7. **测试覆盖**：已有 146 个单测，可补集成测试、E2E
8. **Web3 落地**：已预留 tokenId/mintStatus 等字段，可实现形象 NFT 化

---

## 附：关键文件索引

| 文件 | 职责 |
|------|------|
| `prisma/schema.prisma` | 数据模型 + 索引 + 级联 |
| `src/lib/db.ts` | Prisma 单例 |
| `src/lib/auth.ts` | JWT 签发/验证 + 密码哈希 + requireAuth |
| `src/lib/rateLimit.ts` | 滑动窗口限流 |
| `src/lib/partsValidation.ts` | parts 严格校验 |
| `app/api/avatar/*` | 形象 CRUD（含越权校验） |
| `app/api/poster/*` | 海报异步任务 |
| `src/poster/*` | 海报 Provider 适配器 + 图片处理 |
| `src/lib/memory.ts` | 团队记忆检索（ChromaDB 降级到 JSON） |
