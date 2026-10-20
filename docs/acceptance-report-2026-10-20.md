# avatar-dressup 项目测试验收报告

> 验收日期：2026-10-20
> 验收角色：资深测试工程师 + 资深产品经理
> 验收对象：main 分支最新提交 `0faebb8`（feat: rate limit login/register...）
> 验收方式：文档与代码全量走读 + 自动化测试 + 生产构建 + 真实 HTTP 功能实测
> 验收环境：Windows + Node 22.22.2 + pnpm 9.15.0 + SQLite（本地替代 PostgreSQL）+ POSTER_PROVIDER=mock
>
> **🔄 修复状态更新（2026-10-20 下午，commit `9dd0e80`）**：
> 本报告发现的问题已全部修复并验证——P0-1 私钥移除（需用户在 Gitee/服务器侧完成轮换）、P0-2 语法错误、
> P1-2 环境配置、P1-4 poster 鉴权+限流+归属、P2-1 parts 校验、P2-2 海报文件存储、P2-3 JWT fail-fast、
> P2-4 dev.db 出库、P3 全部；另修复一个验收时未发现的缺陷：PATCH 不处理 parts（编辑换装被静默丢弃）。
> 测试从 120 例扩至 138 例全通过；worker 部署方案（PM2 双进程）见 docs/deploy.md 第 6 章。
> 仍需人工处理：① Gitee 流水线密钥管理配置 DEPLOY_KEY；② 服务器 authorized_keys 轮换；
> ③ git 历史中的私钥清理（filter-repo）；④ 生产数据库执行 prisma db push 同步 PosterJob.userId 列。

---

## 一、验收结论（先说结论）

**验收结论：有条件通过（建议暂缓对外上线，修复 P0 后可灰度）**

| 维度 | 结果 |
|---|---|
| 单元/集成测试 | ✅ 16 套件 120 用例全通过（修复 2 处阻塞问题后） |
| 类型检查 | ✅ tsc --noEmit 零错误 |
| 生产构建 | ✅ next build 成功，11 个路由正常产出 |
| 核心功能链路 | ✅ 注册/登录/会话/CRUD/越权拦截/限流/海报异步闭环全部实测通过 |
| 安全 | ⚠️ 发现 1 个 P0 级安全事故（SSH 私钥入库）+ 2 个 P1 安全风险 |
| 上线就绪度 | ⚠️ 生产环境海报功能实际不可用（worker 未部署） |

**一句话总结**：代码质量与功能完成度对个人项目/作品集而言相当优秀（测试覆盖 120 例、类型严格模式、竞态处理细致），核心链路真实跑通；但**最新提交的语法错误说明缺乏 CI 门禁**，且存在 SSH 私钥泄露这种必须立刻处理的安全事故，以及“海报功能在生产环境实际不可用”的产品完整性缺口。

---

## 二、验收过程与证据

### 2.1 静态验证

| 检查项 | 结果 | 说明 |
|---|---|---|
| 全部文档走读 | ✅ | README、handoff、2 份设计文档、deploy、database-guide（1096 行） |
| 全部代码走读 | ✅ | app/ 11 路由、components/、src/（avatar/state/poster/lib/worker）、prisma、scripts |
| TypeScript strict | ✅ | tsc --noEmit 零错误 |
| pnpm-lock 一致性 | ⚠️ | lockfile 落后于 package.json（antd 已加入依赖但 lockfile 无记录）——本次验收已重新生成 |

### 2.2 动态验证（真实 HTTP 请求，生产模式 next start）

| # | 用例 | 预期 | 实际 | 结果 |
|---|---|---|---|---|
| 1 | 注册新用户 | 201 + 用户信息 | 201 | ✅ |
| 2 | 重复用户名 | 409 | 409 + "用户名已被注册" | ✅ |
| 3 | 错误密码登录 | 401 | 401 | ✅ |
| 4 | 正确登录 | 200 + Cookie | 200 | ✅ |
| 5 | GET /api/auth/me 会话校验 | 200 + 用户身份 | 200 | ✅ |
| 6 | 未登录访问形象列表 | 401 | 401 + "请先登录" | ✅ |
| 7 | 创建形象 | 201 | 201 | ✅ |
| 8 | 列出我的形象 | 200 + 数据 | 200 | ✅ |
| 9 | PATCH 编辑形象 | 200 | 200 | ✅ |
| 10 | 用户 B 访问用户 A 的形象 | 403 | 403 + "无权访问" | ✅ |
| 11 | 海报任务（坏 JPEG） | 处理失败并标记 | failed + sharp 错误信息入库 | ✅ |
| 12 | 海报任务（合法 JPEG） | 201 + jobId | 201 | ✅ |
| 13 | 海报轮询（worker 运行中） | done + 海报图 | done + base64 JPEG | ✅ |
| 14 | 注册限流（第 6 次/分钟） | 429 | 429（计数准确） | ✅ |
| 15 | 非法 style 提交海报 | 400 | 400 + "未知风格" | ✅ |
| 16 | 登出后访问受保护接口 | 401 | 401 | ✅ |
| 17 | 重新登录后删除形象 | 200 | 200 | ✅ |
| 18 | **非法 parts 字符串创建形象** | **应 400 拒绝** | **201，垃圾数据入库** | ❌ |

### 2.3 质量门禁结果汇总

```
pnpm vitest run   →  Test Files 16 passed (16), Tests 120 passed (120)
pnpm tsc --noEmit →  零错误
pnpm next build   →  ✓ Compiled successfully, 11 routes
```

---

## 三、缺陷清单（按严重程度分级）

### P0 — 必须立即处理（阻断上线）

#### P0-1 部署流水线泄露 SSH 私钥（安全事故）
- **位置**：`.workflow/流水线-202610161608.yml` 第 111-160 行
- **问题**：Gitee 流水线配置文件中以明文形式硬编码了完整的 `DEPLOY_KEY` SSH 私钥，并随 git 提交入库
- **影响**：任何能 clone 仓库的人（含 Gitee 平台侧）均可直接 SSH 登录生产服务器 49.233.148.141，等于生产环境完全暴露
- **修复建议**：
  1. **立即**在 Gitee 上将该私钥从部署主机 `~/.ssh/authorized_keys` 移除并重新生成密钥对
  2. 从 git 历史中清除该文件（git filter-repo / BFG），或至少将私钥移到 Gitee 流水线的“密钥管理”功能中
  3. 轮换所有可能受影响的凭据

#### P0-2 最新提交包含语法错误，登录/注册接口必挂（构建级阻断）
- **位置**：`src/lib/rateLimit.ts:58`
- **问题**：`return { ... })` 行尾是 `)` 而非 `;`，括号不匹配，vite/oxc 直接报 PARSE_ERROR；该文件被 `app/api/auth/login/route.ts` 和 `app/api/auth/register/route.ts` 导入
- **影响**：最新提交 `0faebb8` 在干净环境无法通过构建/测试（本次验收已顺手修复为 `}`，见 4.2 节），登录注册接口在生产运行时会 500
- **根因**：提交前未运行测试（详见 P1-1），CI 缺失
- **修复建议**：本次验收已修复；补提交即可。同时按 P1-1 建 CI 门禁

### P1 — 上线前必须修复

#### P1-1 无任何 CI 门禁，坏提交直接进 main
- **证据**：P0-2 的语法错误进入了 main；`pnpm-lock.yaml` 与 `package.json` 不同步（antd 依赖缺失）也进了 main；本地全量测试 3 个用例失败（测试桩未跟上生产代码）
- **影响**：main 分支可信度低，任何人（包括作者自己）克隆后无法一次跑通
- **修复建议**：Gitee Go 流水线加 PR/push 门禁：`pnpm install && pnpm typecheck && pnpm test && pnpm build`

#### P1-2 .env 的 DATABASE_URL 与 schema.prisma 冲突，新环境必跑不通
- **证据**：`.env` 写着 `DATABASE_URL="file:./dev.db"`（SQLite），`schema.prisma` 是 `provider = "postgresql"`；Prisma 运行时直接抛 "the URL must start with the protocol postgresql://"；schema 第 1 行注释“本地用 SQLite，上线改 mysql:// 即可”与实际 postgresql 也自相矛盾
- **影响**：新开发者克隆项目后 `pnpm test` / `pnpm dev` 必然失败（本机无 PostgreSQL 时无解），本次验收只能靠自建 SQLite 测试 schema 绕过
- **修复建议**：`.env` 改为 PostgreSQL 连接串模板 + README 写明本地起库步骤（或提供 docker-compose pg）；删除误导注释

#### P1-3 海报 Worker 生产环境未部署，海报功能线上实际不可用
- **证据**：`.workflow/流水线-202610161608.yml` 部署脚本与 `docs/handoff.md` 的 PM2 命令均只启动 `pm2 start "npx next start"`，全仓库无任何地方启动 `src/worker/posterWorker.ts`；handoff.md 也自述“海报生成目前是假适配器”
- **影响**：用户线上提交海报任务后永远停在 pending，前端轮询超时报错——产品核心卖点（生成海报）在生产是死功能
- **修复建议**：PM2 增加第二个进程 `pm2 start "npx tsx src/worker/posterWorker.ts" --name poster-worker`；或改造为 Next.js route 内联处理/系统 cron

#### P1-4 poster 接口无需登录即可无限刷任务（配合限流缺失=DoS 放大器）
- **证据**：`app/api/poster/route.ts` 全文无 auth 检查；PosterJob 表无 userId 字段；单图 4MB 上限，入库为 data URL 字符串
- **影响**：匿名用户可脚本化灌 PosterJob 表；每条任务含 4MB base64（约 5.3MB 文本），1000 条 ≈ 5GB 数据库膨胀；虽然 worker 会消费，但 mock 适配器处理极快，真实适配器接入后就是存储型 DoS
- **修复建议**：加登录校验 + 按 userId 限流；resultImageUrl 改为对象存储 URL 而非 data URL 入库

### P2 — 重要，尽快修复

#### P2-1 Avatar.parts 服务端零校验，垃圾数据直接入库
- **证据**：实测 `parts: "not-an-object"`（字符串）创建形象返回 201，DB 中存入 `"\"not-an-object\""`；`safeParseParts` 只做解析容错（解析失败给默认值），不做结构校验
- **影响**：DB 可被写入任意结构数据；前端读取后行为未定义；后续做同步/导出/分享功能时是隐患
- **修复建议**：POST/PATCH 前用 zod schema 校验 parts：`Record<string, string[]>`，非法直接 400

#### P2-2 海报结果以 base64 data URL 存 DB
- **证据**：实测 done 任务返回 `resultImageUrl: "data:image/jpeg;base64,..."`（数百 KB 文本）；posterWorker.ts 注释自认“真实环境应上传云存储”
- **影响**：DB 膨胀 + 每次轮询接口传输完整 base64（前端每 2 秒拉一次全量大图）；列表页若引用 posterUrl 同样灾难
- **修复建议**：worker 完成后上传对象存储（COS/S3），DB 只存 URL

#### P2-3 JWT_SECRET 有硬编码 fallback
- **证据**：`src/lib/auth.ts` 中 `process.env.JWT_SECRET ?? 'avatar-dressup-fallback-secret'`；`.env` 里也是弱值 "avatar-dressup-dev-secret-2026"
- **影响**：生产若漏配 JWT_SECRET，任何知道源码的人可伪造任意用户会话
- **修复建议**：生产模式未配置时直接 fail-fast 抛错，而不是 fallback

#### P2-4 prisma/dev.db（含真实用户数据）被 git 追踪
- **证据**：`git ls-files` 包含 prisma/dev.db（40KB，10月16日有数据）
- **影响**：用户凭据哈希随仓库分发；仓库公开则等于数据泄露
- **修复建议**：`git rm --cached prisma/dev.db` + .gitignore

#### P2-5 限流为进程内存版，与 PM2 单实例强耦合
- **证据**：`src/lib/rateLimit.ts` 注释自述局限；实现为进程内 Map
- **影响**：未来扩多实例时限流上限自动翻倍失效；重启即清零
- **修复建议**：多实例前换 Redis；单实例部署可接受（注释已声明设计边界，属已知取舍）

### P3 — 建议/瑕疵

1. **docs/handoff.md（关键交接文档）未提交 git**——它包含部署地址、11 个已修复坑等关键信息，只存在于本地，换机器即丢失
2. **schema.prisma 首行注释**“本地用 SQLite（文件），上线改 mysql:// 即可”与现实（postgresql）矛盾，误导新人
3. **测试桩与生产代码脱节**：`vi.mock('next/headers')` 未跟上 `setSessionCookie` 新增的 `headers()` 调用（本次验收已修复）；且测试同 IP 连发请求会触发自身限流（已通过独立 IP 头修复）——建议把限流器做成可注入以便测试
4. **rateLimit 清理阈值 CLEANUP_EVERY=1000**：低流量场景（<1000 次请求）过期桶永不清理，轻微内存泄漏；建议改为按时间间隔清理
4. **`@types/bcryptjs` 标记 deprecated**（bcryptjs 3.x 自带类型），可移除
5. **Web3 预留字段**（tokenId/mintStatus/chainId 等）已进 schema 和 API 但无任何功能——产品视角建议明确 roadmap 或删除，避免维护成本
6. **错误信息区分度过高**：登录失败统一“用户名或密码错误”（✅做得对），但注册的“用户名需 3-20 位字母数字下划线”等信息暴露了校验规则，可接受但需知晓

---

## 四、产品经理视角评估

### 4.1 产品完整度

| 模块 | 完成度 | 备注 |
|---|---|---|
| 3D 换装核心体验 | ★★★★★ | 部位切换/预设/套装补全/骨骼重绑定/缩略图，交互细节到位 |
| 账号体系 | ★★★★☆ | 注册/登录/登出/会话/限流完整；缺找回密码、改密码、注销 |
| 我的形象库 | ★★★★☆ | CRUD + 越权隔离完整；封面图为空时体验待查（coverUrl 生成链路依赖缩略图上传，未在本次实测范围） |
| 海报生成 | ★★☆☆☆ | 前后端链路通，但生产无 worker = 线上死功能；且是 mock 假适配器，无真实图生图 |
| Web3 身份 | ☆☆☆☆☆ | 仅 schema 预留字段，无任何 UI/逻辑 |
| 部署与运维 | ★★★☆☆ | 流水线自动化程度高，但存在私钥泄露；无监控告警（handoff 自述 Sentry 待接） |

### 4.2 用户体验风险点（按优先级）

1. **海报永远 pending**（生产）——用户点“生成海报”后无限转圈直至超时，这是当前线上最伤体验的问题
2. **密码无找回途径**——忘记密码 = 账号作废，对已上线产品是高频客诉源
3. **形象封面 coverUrl 为 null 的展示**——列表页若依赖封面，未保存封面的形象如何展示需确认（实测创建后 coverUrl 为 null）
4. **限流提示**“操作过于频繁，请 N 秒后再试”——文案清晰 ✅，但注册限流 5 次/分钟对正常用户偏严（连错两次用户名格式就占 3 次）

### 4.3 产品建议

- **短期（上线前）**：修 P0/P1 → 部署 worker（哪怕 mock 适配器）→ 明确海报是“演示功能”还是“核心卖点”，若是后者必须接真实图生图服务
- **中期**：密码找回（邮箱/手机）→ parts 校验 → 对象存储接海报 → CI 门禁
- **长期**：Web3 字段或做或删；多实例前把限流换 Redis；监控告警（Sentry + PM2 告警）

### 4.4 与竞品/常规产品标准对照

以“3D 虚拟形象 + 换装”品类衡量：核心换装体验达到可发布水准，账号与数据隔离做得很规范（多数个人项目会漏 403 这类越权拦截，本项目有且被实测验证）。短板集中在**海报生成这个增值功能的落地度**与**工程化配套（CI/密钥管理/监控）**。

---

## 五、测试工程师视角评估

### 5.1 测试资产评价

- **120 个自动化用例**覆盖了：认证全流程、CRUD+越权、海报请求校验、slotRules 纯函数、viewerSync 竞态回滚、AvatarRig 重绑定、manifest 资产一致性、海报风格输出（真实 sharp 渲染断言）——**对个人项目来说是罕见的高水准**
- 特别是 `viewerSync.test.ts` 的失败回滚断言、`rebind.test.ts` 的骨骼映射、`poster.test.ts` 的真实图像 diff，属于多数团队都懒得写的深度用例
- **短板**：无 E2E（Playwright）；API 测试直接调 route handler 而非起真实服务器（本次实测补上了这块）；无性能/压力测试

### 5.2 本次验收新增的测试发现（供回归）

1. parts 结构校验缺失（P2-1）——建议新增用例：非对象 parts、槽位值非数组、含未知槽位
2. poster 无鉴权（P1-4）——建议用例：未登录提交海报任务应 401
3. 限流与测试框架的互斥（本次踩坑）——限流器建议提供 reset 注入口

### 5.3 验收过程本身的说明（重要）

本次验收过程中，为解除测试阻塞做了以下**必要的环境修复**（不属于项目缺陷，但如实记录）：

1. 修复 `src/lib/rateLimit.ts:58` 语法错误 `)` → `}`（P0-2，已修，待提交）
2. 更新 `tests/auth.test.ts` 的 next/headers mock（补 headers()）与请求 IP 头（避免限流串扰）（已修，待提交）
3. 新建 `prisma/schema.test-sqlite.prisma`（本地无 PostgreSQL 的测试替代方案，验收后已保留，建议团队评估是否纳入）
4. 重新生成 `pnpm-lock.yaml`（补 antd 等缺失依赖）
5. 验收创建的测试数据（qa_user_001/002 等）已在验收库中，生产库不受影响（验收用的是独立 SQLite 文件）

---

## 六、上线建议（Go/No-Go）

**No-Go（暂缓上线）**，原因与放行条件：

| # | 阻断项 | 放行条件 |
|---|---|---|
| 1 | SSH 私钥泄露（P0-1） | 私钥轮换 + git 历史清理完成 |
| 2 | 最新提交语法错误（P0-2） | 已修复，提交 + 加 CI 门禁防复发 |
| 3 | 海报功能线上不可用（P1-3） | worker 部署，或暂时下线海报入口 |
| 4 | poster 接口无鉴权（P1-4） | 加登录校验 + 用户级限流 |

**满足 1-4 后可灰度上线**（小范围真实用户），全量上线前再清 P2 项。

灰度期建议监控指标：注册成功率、登录 500 率、海报任务 pending 积压量、PosterJob 表体积增速、/avatar/ 静态资源 4xx 率。

---

## 附录：验收环境与命令清单

```bash
# 依赖安装（修复 lockfile）
pnpm install --no-frozen-lockfile

# 质量门禁
pnpm vitest run          # 120/120 通过
pnpm tsc --noEmit        # 零错误
pnpm next build          # 成功

# 功能实测（生产模式 + SQLite 测试库）
DATABASE_URL="file:./test.db" JWT_SECRET="..." next start -p 3210
DATABASE_URL="file:./test.db" POSTER_PROVIDER=mock npx tsx src/worker/posterWorker.ts
# 18 个 HTTP 用例（curl）全部执行，17 通过 1 失败（parts 校验缺失）
```

> 报告完。核心代码质量是合格且亮眼的，问题集中在工程化配套与安全卫生——修完 P0/P1 后，这个项目足以作为团队级作品对外展示。
