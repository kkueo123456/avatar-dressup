#!/bin/bash
set -e

# Avatar Dressup 一键部署脚本（Ubuntu 24.04 LTS）
# 域名: avaup.online
# 用法：ssh root@服务器IP 后执行：
#   bash <(curl -fsSL https://raw.githubusercontent.com/kkueo123456/avatar-dressup/main/scripts/deploy.sh)

APP_DIR="/opt/avatar-dressup"
DB_NAME="avatar_dressup"
DB_USER="avatar"
APP_PORT=3000
DOMAIN="avaup.online"

echo "=== Avatar Dressup 部署脚本 ==="
echo "域名: ${DOMAIN}"

# ── 1. 系统更新 ──
echo "[1/10] 更新系统..."
apt-get update && apt-get upgrade -y

# ── 2. 安装 Node.js 20 ──
echo "[2/10] 安装 Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ── 3. 安装 PostgreSQL 16 ──
echo "[3/10] 安装 PostgreSQL..."
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# ── 4. 创建数据库和用户 ──
echo "[4/10] 配置数据库..."
DB_PASS=$(openssl rand -base64 32)
sudo -u postgres psql <<EOF
CREATE DATABASE ${DB_NAME};
CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASS}';
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};
EOF

# ── 5. 安装 Nginx + Certbot ──
echo "[5/10] 安装 Nginx 和 Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable nginx
systemctl start nginx

# ── 6. 配置 Nginx ──
echo "[6/10] 配置 Nginx..."
cat > /etc/nginx/sites-available/${DOMAIN} <<'NGINX'
server {
    listen 80;
    server_name avaup.online www.avaup.online;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
NGINX

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# ── 7. 安装 PM2 ──
echo "[7/10] 安装 PM2..."
npm install -g pm2

# ── 8. 拉取代码 ──
echo "[8/10] 拉取代码..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git pull origin main
else
  git clone https://github.com/kkueo123456/avatar-dressup.git "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 9. 安装依赖并构建 ──
echo "[9/10] 安装依赖并构建..."
npm ci

# 生成 .env
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
cat > .env <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
JWT_SECRET="${JWT_SECRET}"
NODE_ENV="production"
NEXT_PUBLIC_APP_URL="https://${DOMAIN}"
EOF

npx prisma generate
npx prisma migrate deploy
npm run build

# ── 10. 启动应用 + 配置 HTTPS ──
echo "[10/10] 启动应用并配置 HTTPS..."
pm2 delete avatar-dressup 2>/dev/null || true
pm2 start npm --name "avatar-dressup" -- start
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# 申请 Let's Encrypt 证书（自动配置 Nginx HTTPS）
echo "正在申请 HTTPS 证书..."
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} 2>/dev/null || {
  echo "⚠️ 证书申请失败（域名解析可能未生效），请稍后手动执行："
  echo "   certbot --nginx -d ${DOMAIN}"
}

echo ""
echo "=========================================="
echo "=== 部署完成 ==="
echo "=========================================="
echo "域名: https://${DOMAIN}"
echo "数据库: ${DB_NAME}"
echo "数据库密码: ${DB_PASS}"
echo "JWT 密钥: ${JWT_SECRET}"
echo "应用目录: ${APP_DIR}"
echo ""
echo "常用命令："
echo "  查看日志: pm2 logs avatar-dressup"
echo "  重启应用: pm2 restart avatar-dressup"
echo "  更新代码: cd ${APP_DIR} && git pull && npm ci && npm run build && pm2 restart avatar-dressup"
echo "=========================================="
