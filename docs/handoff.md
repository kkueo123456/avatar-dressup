# avatar-dressup 交接文档

> 生成时间：2026-10-20
> 用途：新会话窗口接手本项目所需的一切上下文。读这一份即可起步。

---

## 1. 项目概览

| 项 | 内容 |
|----|------|
| 名称 | avatar-dressup（虚拟形象换装 + 海报生成） |
| 技术栈 | Next.js 14（App Router）+ Prisma + PostgreSQL + Three.js（3D 换装）+ Zustand + antd |
| 运行模式 | `npx next start`（普通模式，**非 standalone**） |
| 端口 | 3000 |
| 用户系统 | 用户名/密码（bcryptjs 哈希 + JWT via jose，HttpOnly Cookie） |
| Web3 预留 | Avatar 表预留 tokenId/mintStatus/chainId/contractAddress/ownerWallet/metadataUri 字段，未实装 |

---

## 2. 仓库与部署链路

```
本地代码
  │ git push gitee main      （gitee remote → gitee.com/pu_zi_jie/avatar-dressup）
  ▼
Gitee Go 流水线（.workflow/流水线-202610161608.yml）
  ├─ 构建阶段：npm ci → prisma generate → next build → 打包产物 .tar.gz
  └─ 部署阶段：SSH 到服务器执行部署脚本
        ▼
服务器 49.233.148.141:~/avatar-dressup
  └─ PM2 进程 avatar-dressup（npx next start）
```

**Remote 配置**：
- `origin` → GitHub (`kkueo123456/avatar-dressup`)
- `gitee` → Gitee (`pu_zi_jie/avatar-dressup`) ← **流水线只认这个**

> VSCode 默认对比 `origin`（GitHub），所以推 gitee 后 VSCode 会提示"超前 N 个 commit"，这是正常的。如想同步 GitHub：`git push origin main`。

---

## 3. 服务器与域名

| 项 | 值 |
|----|---|
| 服务器 | 腾讯云轻量应用服务器，广州区 |
| 公网 IP | `49.233.148.141` |
| SSH 用户 | `ubuntu` |
| 项目目录 | `~/avatar-dressup` |
| 域名 | `avaup.online`（DNS A 记录 → 49.233.148.141，DNSPod 托管） |
| Nginx | 已配，`server_name avaup.online www.avaup.online`，SSL 证书有效期到 2027 |
| 防火墙（腾讯云） | 已放行 22 / 80 / 443 / 3000 |

### ⚠️ 关键阻塞：域名未备案

`avaup.online` **未在工信部备案**。腾讯云在骨干网网关按 SNI 域名拦截未备案域名的 443 流量，表现为：
- 浏览器访问 `https://avaup.online` → `ERR_CONNECTION_CLOSED`，44ms 内断开
- 服务器 `tcpdump` 抓不到任何 443 包（拦截发生在到达服务器之前）
- IP 直连 `http://49.233.148.141:3000` 完全正常
- 所有设备都访问不了域名（与本地代理/VPN 无关）

**当前状态**：用户已提交备案，等审核（2-4 周）。

**备案期间访问方式**：`http://49.233.148.141:3000`（IP 直连）。

**备案通过前的备选方案**（未采纳，备用）：
- A. 套 Cloudflare CDN（域名解析到 CF 节点，回源走 IP，绕过 SNI 拦截）
- B. 服务器迁到香港/新加坡（境外不需备案）

---

## 4. 数据库

| 项 | 值 |
|----|---|
| 类型 | PostgreSQL |
| 库名 | `avatar_dressup` |
| 用户 | `avatar` |
| 密码 | 见服务器 `~/avatar-dressup/.env`（含 `!` 特殊字符，bash 中必须用**单引号**包裹） |
| 连接 | `localhost:5432` |

**表结构**（`prisma/schema.prisma`）：
- `users`：id, username(unique), password_hash, created_at
- `avatars`：id, user_id(外键→users, onDelete Cascade), name, base_id, parts(JSON 字符串), cover_url, poster_url, created_at, updated_at + Web3 预留字段
- `poster_jobs`：id, style, status, input_image_url, result_image_url, error_message, 时间戳

### ⚠️ 无 migrations 目录

项目从没用过 `prisma migrate`，表结构靠 `prisma db push` 同步。**部署脚本里已加 `npx prisma db push --skip-generate`**，schema 改动会自动同步到数据库。

本地有 `prisma/dev.db`（SQLite 残留，不用管），生产用 PostgreSQL。

---

## 5. 部署脚本关键逻辑（已踩过的坑都在这里）

`.workflow/流水线-202610161608.yml` 部署阶段脚本（按顺序）：

```bash
cd ~/avatar-dressup
# 1. 备份 .env 和 public（产物里不含它们）
cp .env /tmp/avatar-env.backup
cp -r public /tmp/avatar-public.backup
# 2. 清理旧构建产物（保留 node_modules 和源码）
rm -rf .next public prisma next.config.ts tsconfig.json package.json package-lock.json
# 3. 解压新产物
tar -xzf output.tar.gz
# 4. 恢复 .env 和 public
cp /tmp/avatar-env.backup .env
[ ! -d public ] && cp -r /tmp/avatar-public.backup public || git checkout -- public/
# 5. 安装依赖 + 生成 Prisma 客户端 + 同步表结构
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push --skip-generate
# 6. 同步服务器源码到最新提交（保证兜底构建用的是新代码）
git fetch https://gitee.com/pu_zi_jie/avatar-dressup.git main && git reset --hard FETCH_HEAD
# 7. 兜底构建（产物 .next 传输失败时）
[ ! -f .next/BUILD_ID ] && NODE_OPTIONS='--max-old-space-size=1536' npx next build
# 8. 启动（关键：POSIX . 加载 .env，PM2 进程才能继承 DATABASE_URL）
set -a && . ./.env && set +a
pm2 delete avatar-dressup 2>/dev/null || true
pm2 start "npx next start" --name avatar-dressup
pm2 save
```

### 已踩并已修复的部署坑（必读）

| 坑 | 现象 | 修复 |
|----|------|------|
| bash `source` 在 dash 里不存在 | 流水线 shell 是 sh，`source .env` 静默失败 → 全部接口 500（Prisma 认证失败） | 改 POSIX 写法 `. ./.env` |
| `.env` 里密码含 `!` | bash 历史扩展吃掉 `!` → 密码变 `Avatar123` → 认证失败 | 用单引号 `export VAR='...'`；`source` 读文件不受影响 |
| `pm2 delete + start` 丢环境变量 | PM2 重启后进程没有 `DATABASE_URL` | `set -a && . ./.env && set +a` 在 `pm2 start` 前 |
| 产物不含 `src/`，兜底构建用旧源码 | 服务器源码停留在旧版本，构建出来是旧代码（Cookie 修复不生效） | 兜底构建前 `git reset --hard FETCH_HEAD` 同步源码 |
| 无 migrations 目录，schema 改了不同步 | 新字段（poster_url 等）缺失 → `The column xxx does not exist` | 部署加 `npx prisma db push --skip-generate` |
| `rm -rf public` 后没恢复 | manifest.json 404 | 删前备份，解压后恢复 |
| Cookie `Secure` 写死 `NODE_ENV==='production'` | HTTP 直连时浏览器不发送 Cookie → 登录态丢失 | 按 `x-forwarded-proto` 动态判断 |

---

## 6. 本次会话改动清单（按提交顺序）

| commit | 说明 |
|--------|------|
| `ccbe8f4` | Cookie Secure 按请求协议判断（HTTP 不设 Secure） |
| `92cbb05` | 流水线 pm2 start 前 source .env |
| `29fc72d` | source 改 POSIX 的 `.`（兼容 sh/dash） |
| `7dc2f08` | 兜底构建前 git 同步服务器源码 |
| `f7da244` | 部署加 `prisma db push` 同步表结构 |
| `f59d5c6` | 保存后自动跳转 `/avatars`；卡片悬浮去 Y 轴位移改阴影 |
| `0aad049` | 编辑时名称回显；编辑保存改 PATCH（不再产生重复形象）；服务端校验补漏；parts 安全解析 |
| `0faebb8` | 登录/注册限流；列表页显示用户名；自定义删除确认弹窗 |

---

## 7. 当前状态与待办

### ✅ 已解决
- 部署链路全自动化（push → 流水线 → 服务起来）
- 数据库连接、表结构同步
- 登录态、Cookie、编辑回显、保存去重
- 悬浮样式、限流、自定义弹窗

### ⏳ 进行中
- **域名备案**（等审核，审核期间用 IP:3000）

### 📋 待办（未做，按需排期）
- 登录态过期统一拦截（目前各页分散处理 401）
- 接 Sentry 错误监控
- 限流改 Redis（多实例时）
- 海报生成接真实图生图服务（目前是假适配器 `posterWorker.ts`）

---

## 8. 运维速查

### 看状态
```bash
cd ~/avatar-dressup
pm2 status
pm2 logs avatar-dressup --err --lines 20 --nostream
curl -s http://localhost:3000/api/auth/me    # 返回 JSON 即正常
ss -tlnp | grep 3000
```

### 手动救急（流水线挂了时）
```bash
cd ~/avatar-dressup
pm2 delete avatar-dressup
set -a && . ./.env && set +a
pm2 start "npx next start" --name avatar-dressup
pm2 save
```

### 改了 schema 后手动同步表结构
```bash
cd ~/avatar-dressup
npx prisma generate
npx prisma db push --skip-generate
pm2 restart avatar-dressup
```

### 数据库直连
```bash
PGPASSWORD='密码' psql -U avatar -h localhost -d avatar_dressup
\dt                    # 看表
\d avatars             # 看结构
SELECT id,username FROM users;
```

### 备份
```bash
pg_dump -U avatar avatar_dressup > backup.sql
```

---

## 9. 关键文件地图

```
prisma/schema.prisma              数据模型（改表结构改这里）
.workflow/流水线-202610161608.yml  部署流水线（改部署逻辑改这里）
src/lib/auth.ts                   鉴权：JWT 签发/验证、Cookie、requireAuth
src/lib/db.ts                     Prisma 客户端单例
src/lib/rateLimit.ts              进程内限流（登录/注册用）
components/DressUp.tsx            换装主组件（保存/编辑/海报流程入口）
components/SaveDialog.tsx         保存弹窗（含名称回显 initialName）
components/PosterDialog.tsx       海报生成弹窗
components/AvatarCard.tsx         形象卡片（含删除确认）
components/ConfirmDialog.tsx      通用确认弹窗
app/api/avatar/route.ts           POST 创建 / GET 列表
app/api/avatar/[id]/route.ts      GET 详情 / PATCH 更新 / DELETE 删除
app/api/auth/{login,register,me,logout}/route.ts
app/avatars/page.tsx              我的形象库列表页
state/authStore.ts                Zustand 鉴权状态
worker/posterWorker.ts            海报生成 worker（假适配器）
docs/database-guide.md            数据库学习文档（给前端转后端用）
```

---

## 10. 测试走查结论（2026-10-20）

25 个全生命周期用例，本次会话修复 11 个，全部已上线。最小回归路径：

```
1. 注册/登录
2. /create 换装 → 仅保存 → 自动跳 /avatars
3. 点卡片进编辑 → 弹窗名称已回显
4. 改件衣服 → 保存 → 回 /avatars → 数量没+1（是更新不是新增）  ← 关键回归点
5. 保存并生成海报 → 完成后跳 /avatars，卡片出现"已生成海报"标签
6. 删除一个形象 → 自定义红色确认弹窗 → 列表减少
7. 连续错密码 10 次 → 第 11 次提示限流
```

---

## 11. 重要约束（给新会话的提醒）

1. **改部署相关问题时，优先改 `.workflow/流水线.yml` 并 push，不要让用户手动 SSH 改服务器** —— 手动修复只解决一次，改流水线才一劳永逸。
2. **服务器密码含 `!`**，bash 中用单引号；`source`/`.` 读 .env 文件不受影响。
3. **部署脚本里用 POSIX 的 `.` 不要用 `source`**（Gitee 流水线 shell 是 dash）。
4. **域名未备案**，备案期间所有"域名访问不了"的问题都不是服务器问题，别再排查服务器。
5. **无 migrations 目录**，schema 改动靠 `prisma db push`，部署脚本已内置。
6. **Next.js 用普通 `next start` 模式**，不要加回 `output: 'standalone'`。
7. 产物路径只能写实际存在的目录（`.next/ public/ prisma/ package.json ...`），写不存在的路径（如 `types/`）会让打包失败。
