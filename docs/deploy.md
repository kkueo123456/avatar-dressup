# 部署指南

## 推荐方案：腾讯云轻量服务器 + PostgreSQL

### 1. 购买服务器

- 腾讯云 → 轻量应用服务器
- 系统镜像：**Ubuntu 22.04 LTS**
- 配置：2核2G4M（新用户 ~99元/年）
- 记录公网 IP 和 root 密码

### 2. 连接服务器

```bash
ssh root@你的服务器IP
```

### 3. 一键部署

```bash
curl -fsSL https://raw.githubusercontent.com/kkueo123456/avatar-dressup/main/scripts/deploy.sh | bash
```

脚本会自动完成：
- 更新系统
- 安装 Node.js 20
- 安装 PostgreSQL 15
- 创建数据库和用户
- 安装 PM2 进程守护
- 拉取代码
- 安装依赖 + 构建
- 运行 Prisma 迁移
- 启动应用

### 4. 访问应用

部署完成后：
```
http://你的服务器IP:3000
```

### 5. 配置 Nginx + HTTPS（推荐）

```bash
apt-get install -y nginx certbot python3-certbot-nginx
```

创建 Nginx 配置 `/etc/nginx/sites-available/avatar-dressup`：

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

启用：
```bash
ln -s /etc/nginx/sites-available/avatar-dressup /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# 申请 HTTPS 证书
certbot --nginx -d your-domain.com
```

### 6. 海报 Worker 部署（重要）

海报生成是异步任务：Web 进程只负责把任务写入 `poster_jobs` 表（状态 `pending`），真正消费任务的是独立进程 `src/worker/posterWorker.ts`。**只启动 next start 而不启动 worker，用户提交的海报任务会永远停在 pending。**

#### 6.1 前置：服务器 .env 增加配置

```bash
cd ~/avatar-dressup
vim .env   # 或 nano .env
```

增加一行（当前用 mock 假适配器；接真实图生图服务后改对应标识）：

```dotenv
POSTER_PROVIDER=mock
```

> 注意：worker 的 provider 选择是 fail-fast 设计——`.env` 里没配 `POSTER_PROVIDER` 时 worker 会直接报"海报服务未配置"退出，绝不静默运行。所以这行是必需的。

#### 6.2 立即热修复（不等下次发版，在服务器上手动执行）

```bash
cd ~/avatar-dressup
pm2 start node_modules/tsx/dist/cli.mjs --name poster-worker -- src/worker/posterWorker.ts
pm2 save
```

> 前提：服务器代码已包含 `src/worker/` 目录和 `node_modules/tsx`（2026-10-20 之前部署的服务器如果没有 tsx，先跑 `npm install --legacy-peer-deps`）。环境变量按老方式注入：`set -a && . ./.env && set +a`，然后再执行上面的 pm2 命令。

#### 6.3 标准方式：PM2 双进程（已并入流水线）

仓库根目录的 `ecosystem.config.cjs` 声明了两个进程：

| 进程名 | 作用 | 说明 |
|---|---|---|
| `avatar-dressup` | next start（Web） | 端口 3000 |
| `poster-worker` | 海报任务消费者 | tsx 直跑 TS 源码 |

配置文件会自动读取 `.env` / `.env.local` 注入进程环境（无需再手动 source）。日常命令：

```bash
pm2 start ecosystem.config.cjs     # 启动全部（首次 / 全量重启）
pm2 restart ecosystem.config.cjs   # 发版后重启全部
pm2 restart poster-worker          # 只重启 worker（改了 .env 后执行）
pm2 logs poster-worker             # 看 worker 实时日志
pm2 status                         # 确认两个进程都是 online
```

> 推送 main 分支后 Gitee 流水线会自动完成上述动作（产物包含 ecosystem.config.cjs 与 src/worker/）。

#### 6.4 验证 worker 正常工作

```bash
# 1. 看日志确认启动（应输出：Worker 启动， provider = mock）
pm2 logs poster-worker --lines 5 --nostream

# 2. 在网页上生成一次海报，然后查任务终态（应从 pending 变 done）
#    或直接查数据库：
psql -U avatar avatar_dressup -c "SELECT status, count(*) FROM poster_jobs GROUP BY status;"
```

#### 6.5 故障恢复：清理卡死的 running 任务

worker 若在生成中途被 kill（如发版时任务正在处理），该任务会停留在 `running` 状态且不会再被消费（worker 只捞 `pending`）。恢复方法：

```bash
# 把超过 10 分钟的 running 任务重置回 pending（下次 worker 轮询会重新消费）
psql -U avatar avatar_dressup -c "UPDATE poster_jobs SET status='pending' WHERE status='running' AND started_at < now() - interval '10 minutes';"
```

> 2核2G 服务器上 mock 适配器生成一张海报 < 1 秒，10 分钟阈值足够安全；接真实图生图服务后按实际超时调整。

#### 6.6 已知限制（后续迭代项）

- mock 适配器生成的是程序合成图，非真实 AI 图生图；`POSTER_PROVIDER` 支持新服务时在 `src/poster/index.ts` 注册即可，worker 代码不用动
- 海报结果当前以 base64 存 `poster_jobs.result_image_url`（TEXT 列），任务量大时数据库会膨胀；接真实服务时应同步改造为上传对象存储、DB 只存 URL
- worker 单实例即可（多实例靠"原子抢锁"也能安全并发，但没必要）

### 7. 常用运维命令

```bash
# 查看应用日志
pm2 logs avatar-dressup
pm2 logs poster-worker

# 重启应用
pm2 restart avatar-dressup

# 更新代码
cd /opt/avatar-dressup && git pull && npm ci && npm run build && pm2 restart ecosystem.config.cjs

# 数据库备份
pg_dump -U avatar avatar_dressup > backup_$(date +%Y%m%d).sql

# 数据库恢复
psql -U avatar avatar_dressup < backup_20261016.sql
```

---

## 备用方案：Vercel + Neon（免费）

如果不想买服务器，可以用 Vercel 托管 + Neon Serverless PostgreSQL：

1. 注册 [Vercel](https://vercel.com) 和 [Neon](https://neon.tech)
2. Neon 创建数据库，复制连接字符串
3. Vercel 导入 GitHub 仓库
4. 环境变量添加 `DATABASE_URL` 和 `JWT_SECRET`
5. 自动部署

限制：
- Neon 免费层 500MB 存储
- Vercel Hobby 函数执行时间 10 秒（海报生成可能超时）
- 海报 Worker 需要改成 Vercel Cron Job
