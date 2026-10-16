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

### 6. 常用运维命令

```bash
# 查看应用日志
pm2 logs avatar-dressup

# 重启应用
pm2 restart avatar-dressup

# 更新代码
cd /opt/avatar-dressup && git pull && npm ci && npm run build && pm2 restart avatar-dressup

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
