---
name: 子项目B-登录保存形象Web3预留
overview: 实现用户名密码登录、形象保存（含Web3预留字段）、我的形象列表页（增删改查+点击进入编辑），基于现有Prisma+SQLite架构。
design:
  architecture:
    framework: react
  styleKeywords:
    - Dark theme
    - Tech/Sci-fi
    - Card grid
    - Glassmorphism overlay
    - Inline editing
  fontSystem:
    fontFamily: Orbitron, --font-huangyou, system-ui
    heading:
      size: 28px
      weight: 700
    subheading:
      size: 16px
      weight: 600
    body:
      size: 14px
      weight: 400
  colorSystem:
    primary:
      - "#E8A445"
      - "#F0C674"
    background:
      - "#0F0E14"
      - "#13121A"
      - "#1B1A23"
    text:
      - "#EFEDF3"
      - "#A09DAE"
    functional:
      - "#22C55E"
      - "#EF4444"
      - "#F59E0B"
      - "#3B82F6"
todos:
  - id: db-schema
    content: 扩展 Prisma schema：新增 User、Avatar（含 Web3 字段）、MintStatus enum
    status: completed
  - id: auth-lib
    content: 实现 src/lib/auth.ts：bcrypt 哈希、JWT 签发/验证、requireAuth 中间件
    status: completed
    dependencies:
      - db-schema
  - id: auth-api
    content: 创建认证 API：register、login、logout、me 四条路由
    status: completed
    dependencies:
      - auth-lib
  - id: avatar-api
    content: 创建形象 CRUD API：POST/GET /api/avatar 和 GET/PATCH/DELETE /api/avatar/[id]
    status: completed
    dependencies:
      - auth-lib
  - id: auth-store
    content: 创建 Zustand authStore 和 AuthDialog 登录/注册弹窗组件
    status: completed
  - id: topbar-auth
    content: 改造 TopBar：集成用户菜单（登录/我的形象/退出）
    status: completed
    dependencies:
      - auth-store
  - id: avatar-list
    content: 创建 /avatars 列表页和 AvatarCard 组件（网格、悬停操作、空状态）
    status: completed
    dependencies:
      - avatar-api
      - auth-store
  - id: restore-edit
    content: 改造 DressUp/create 页：支持 avatarId 查询参数加载历史形象
    status: completed
    dependencies:
      - avatar-api
  - id: tests
    content: 编写 auth.test.ts 和 avatarCrud.test.ts 覆盖全部新 API
    status: completed
    dependencies:
      - auth-api
      - avatar-api
  - id: verify
    content: 类型检查 + 全部测试通过 + 端到端冒烟验证
    status: completed
    dependencies:
      - tests
---

## 产品概述
为 Avatar Dressup 增加用户系统与形象持久化能力。用户可注册/登录，保存当前 3D 形象到数据库，在"我的形象"页面管理历史形象，点击即可恢复到换装页继续编辑。保存时预留 Web3 铸造字段，为未来对接区块链做准备。

## 用户确认决策
1. **登录方式**：用户名密码（bcrypt 哈希 + JWT Cookie 会话）
2. **保存流程 B**：先存形象数据（AvatarState JSON），海报由用户手动触发（复用现有 PosterDialog + worker），不自动跑海报
3. **我的形象页面要全面**：列表展示、点击进入编辑、删除、重命名、查看详情
4. **Web3 预留**：现在加进数据库字段（tokenId、铸造状态、链ID、合约地址、钱包地址、元数据URI）

## 核心功能
- 注册/登录：用户名唯一，密码 bcrypt 哈希，JWT 存 HttpOnly Cookie
- 保存形象：将 AvatarState（baseId + equipped 槽位映射）序列化为 JSON 存入数据库，附带名称和封面图 URL（可选）
- 我的形象列表：暗色卡片网格，显示名称、创建时间、封面图、铸造状态
- 形象操作：重命名、删除、查看详情、点击恢复编辑
- 恢复编辑：从"我的形象"点击进入 `/create?id=xxx`，加载历史形象数据到 Zustand store
- Web3 预留字段：形象表含铸造状态枚举和相关链上字段，当前 UI 只读展示

## Tech Stack Selection
- **会话管理**：`jose`（纯 JS JWT，无原生依赖）+ `bcryptjs`（密码哈希）
- **Cookie**：Next.js 内置 `cookies()` / `cookie` header
- **数据库**：Prisma 5 + SQLite（本地），上线改 `mysql://`
- **状态管理**：Zustand（已有），新增 `authStore`
- **API 路由**：Next.js App Router `route.ts`（已有模式）
- **服务端组件**：Next.js 14+ Server Components 做鉴权布局

## Implementation Approach

### 1. 数据库层扩展
扩展 `prisma/schema.prisma`：
- `User` 模型：id、username（unique）、passwordHash、createdAt
- `Avatar` 模型：id、userId（外键）、name、baseId、parts（JSON）、coverUrl、createdAt、updatedAt
- Web3 字段：tokenId、mintStatus（enum）、chainId、contractAddress、ownerWallet、metadataUri
- 保留现有 `PosterJob` 模型不变

### 2. 认证系统
- `POST /api/auth/register`：校验用户名唯一，bcrypt 哈希密码，创建 User，签发 JWT
- `POST /api/auth/login`：校验密码，签发 JWT
- `POST /api/auth/logout`：清除 Cookie
- `GET /api/auth/me`：返回当前登录用户信息（用于前端初始化 authStore）
- JWT 存 HttpOnly Cookie，`/api/avatar/*` 路由统一鉴权中间件

### 3. 形象 CRUD API
- `POST /api/avatar`：创建形象（从请求体取 baseId + parts JSON + name）
- `GET /api/avatar`：列出当前用户的所有形象
- `GET /api/avatar/[id]`：查单个形象详情
- `PATCH /api/avatar/[id]`：重命名
- `DELETE /api/avatar/[id]`：删除

### 4. 恢复编辑
- `/create` 页面支持 `?avatarId=xxx` 查询参数
- `DressUp` 组件在初始化时检测 `avatarId`，调用 `GET /api/avatar/[id]` 加载数据，通过 `replace()` 写入 Zustand store
- 未登录用户访问 `/create` 不受影响

### 5. 前端改造
- 新增 `authStore`（Zustand）：管理登录状态、用户信息
- 新增 `AuthDialog` 组件：登录/注册切换表单
- 新增 `AvatarListPage`（`/avatars` 路由）：形象卡片网格
- 新增 `AvatarCard` 组件：展示封面、名称、铸造状态、操作按钮
- `TopBar` 改造：右侧显示登录/用户名，点击展开"我的形象"入口和退出

### 6. Worker 与海报
- 现有 `PosterDialog` 不变：用户手动截图 → POST `/api/poster` → 轮询查状态 → 得到封面图
- 封面图生成后，前端可选择"设为形象封面"（PATCH `/api/avatar/[id]` 更新 coverUrl）
- Worker 逻辑完全复用，无需改动

### 7. Web3 预留
- 数据库字段现在建好，API 返回时带上
- UI 在形象详情中展示"铸造状态"徽章（未铸造/铸造中/已铸造）
- 铸造操作（调用合约）现在不做，留接口和字段

## Implementation Notes
- **密码安全**：bcryptjs 的 cost factor 用 10（平衡安全与性能）
- **JWT 密钥**：从环境变量 `JWT_SECRET` 读取，本地开发用固定字符串
- **鉴权中间件**：写成 `src/lib/auth.ts` 的 `requireAuth(request)` 函数，统一在 API route 中使用
- **Cookie 安全**：本地开发不严格，上线时加 `secure` 和 `sameSite`
- **blast radius**：不改现有 `PosterDialog`、`posterWorker`、`DressUpContext` 等核心逻辑，只增加新路由和新组件
- **类型检查**：所有新增 API 返回类型与前端类型保持一致

## Architecture Design

```
用户浏览器
    │
    ├── POST /api/auth/register ──┐
    ├── POST /api/auth/login ─────┤ 认证层（bcrypt + jose JWT）
    ├── POST /api/auth/logout ────┘
    │
    ├── GET  /api/auth/me ────────┐
    │                              │
    ├── POST /api/avatar ─────────┤
    ├── GET  /api/avatar ─────────┤ 形象 CRUD（Prisma）
    ├── GET  /api/avatar/[id] ────┤
    ├── PATCH /api/avatar/[id] ───┤
    ├── DELETE /api/avatar/[id] ──┘
    │
    ├── POST /api/poster ─────────┐
    ├── GET  /api/poster/[jobId] ─┘ 现有海报系统（不变）
    │
    │
    ┌─────────────────────────────┐
    │         数据库 SQLite        │
    │  ┌────────┐  ┌───────────┐ │
    │  │ User   │  │ Avatar    │ │
    │  │ PosterJob│  └───────────┘ │
    │  └────────┘                 │
    └─────────────────────────────┘
```

## Directory Structure

```
[MODIFY] prisma/schema.prisma
         # 新增 User、Avatar（含 Web3 字段）、MintStatus enum

[NEW]    prisma/migrations/...
         # Prisma migrate dev 生成（SQLite 用 prisma db push）

[MODIFY] .env
         # 新增 JWT_SECRET

[NEW]    src/lib/auth.ts
         # JWT 签发/验证、密码哈希/校验、requireAuth 中间件

[NEW]    src/state/authStore.ts
         # Zustand auth 状态：user、isLoggedIn、login/logout

[NEW]    app/api/auth/register/route.ts
         # POST 注册

[NEW]    app/api/auth/login/route.ts
         # POST 登录

[NEW]    app/api/auth/logout/route.ts
         # POST 登出

[NEW]    app/api/auth/me/route.ts
         # GET 当前用户

[NEW]    app/api/avatar/route.ts
         # POST 创建、GET 列表

[NEW]    app/api/avatar/[id]/route.ts
         # GET 详情、PATCH 重命名/更新封面、DELETE 删除

[NEW]    components/AuthDialog.tsx
         # 登录/注册弹窗（暗色主题）

[NEW]    components/AvatarCard.tsx
         # 形象卡片：封面、名称、铸造状态、操作按钮

[NEW]    app/avatars/page.tsx
         # 我的形象列表页（服务端组件，暗色卡片网格）

[MODIFY] components/TopBar.tsx
         # 右侧加登录按钮/用户菜单（我的形象/退出）

[MODIFY] components/DressUp.tsx
         # 支持 avatarId 查询参数，加载历史形象

[MODIFY] app/create/page.tsx
         # 透传 searchParams 给 DressUp

[NEW]    tests/auth.test.ts
         # 注册/登录/鉴权 API 测试

[NEW]    tests/avatarCrud.test.ts
         # 形象 CRUD 测试
```

## Agent Extensions

### SubAgent: code-explorer
- **Purpose**: 在计划执行阶段深入探索现有代码库，确认组件边界、类型定义、样式类名，确保新增组件与现有 DressUp、TopBar、PosterDialog 无缝集成
- **Expected outcome**: 输出现有 TopBar、DressUpContext、Viewport 的 Props 接口和关键样式令牌列表，指导 AuthDialog 和 AvatarCard 的接口设计
