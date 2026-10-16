#!/bin/bash
set -e

# Avatar Dressup 一键部署脚本（Ubuntu 22.04）
# 用法：在服务器上执行 bash <(curl -fsSL https://raw.githubusercontent.com/kkueo123456/avatar-dressup/main/scripts/deploy.sh)

APP_DIR="/opt/avatar-dressup"
DB_NAME="avatar_dressup"
DB_USER="avatar"
APP_PORT=3000

echo "=== Avatar Dressup 部署脚本 ==="

# ── 1. 系统更新 ──
echo "[1/8] 更新系统..."
apt-get update && apt-get upgrade -y

# ── 2. 安装 Node.js 20 ──
echo "[2/8] 安装 Node.js..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# ── 3. 安装 PostgreSQL ──
echo "[3/8] 安装 PostgreSQL..."
apt-get install -y postgresql postgresql-contrib
systemctl enable postgresql
systemctl start postgresql

# ── 4. 创建数据库和用户 ──
echo "[4/8] 配置数据库..."
DB_PASS=$(openssl rand -base64 32)
sudo -u postgres psql <<EOF
CREATE DATABASE ${DB_NAME};
CREATE USER ${DB_USER} WITH ENCRYPTED PASSWORD '${DB_PASS}';
GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};
ALTER DATABASE ${DB_NAME} OWNER TO ${DB_USER};
EOF

# ── 5. 安装 PM2（进程守护）──
echo "[5/8] 安装 PM2..."
npm install -g pm2

# ── 6. 拉取代码 ──
echo "[6/8] 拉取代码..."
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git pull origin main
else
  git clone https://github.com/kkueo123456/avatar-dressup.git "$APP_DIR"
  cd "$APP_DIR"
fi

# ── 7. 安装依赖并构建 ──
echo "[7/8] 安装依赖并构建..."
npm ci

# 生成 .env
JWT_SECRET=$(openssl rand -base64 48 | tr -d '\n')
cat > .env <<EOF
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"
JWT_SECRET="${JWT_SECRET}"
NODE_ENV="production"
EOF

npx prisma generate
npx prisma migrate deploy
npm run build

# ── 8. 启动服务 ──
echo "[8/8] 启动服务..."
pm install -g pm2
pm2 delete avatar-dressup 2>/dev/null || true
pm2 start npm --name "avatar-dressup" -- start
pm2 save
pm2 startup systemd -u root --hp /root

echo ""
echo "=== 部署完成 ==="
echo "数据库: ${DB_NAME}"
echo "数据库密码: ${DB_PASS}"
echo "JWT 密钥: ${JWT_SECRET}"
echo "应用目录: ${APP_DIR}"
echo "访问: http://$(curl -s ifconfig.me):${APP_PORT}"
echo ""
echo "建议下一步："
echo "1. 配置 Nginx 反向代理 + HTTPS"
echo "2. 绑定域名"
echo "3. 修改默认数据库密码（可选）"
