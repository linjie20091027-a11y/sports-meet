#!/bin/bash
# ==========================================
# 运动会管理系统 - 云服务器一键部署脚本
# 适用: Ubuntu 20.04+ / Debian 11+
# 使用: bash deploy.sh
# ==========================================

set -e

echo "========================================"
echo "  运动会管理系统 - 自动部署脚本"
echo "========================================"

# ------ 1. 检测系统 ------
if ! command -v node &> /dev/null; then
  echo "[1/5] 安装 Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "  Node.js $(node -v) ✓"

# ------ 2. 安装 PM2 ------
if ! command -v pm2 &> /dev/null; then
  echo "[2/5] 安装 PM2..."
  sudo npm install -g pm2
fi
echo "  PM2 $(pm2 -v) ✓"

# ------ 3. 安装依赖 + 初始化数据库 ------
echo "[3/5] 安装项目依赖..."
npm ci --production=false

echo "  [3/5] 初始化数据库..."
npx prisma generate
npx prisma migrate deploy
node prisma/seed.js

# ------ 4. 创建必要目录 ------
echo "[4/5] 创建运行目录..."
mkdir -p ./logs ./uploads ./data
cp -n .env.example .env 2>/dev/null || true

# ------ 5. 启动服务 ------
echo "[5/5] 启动服务..."
pm2 delete sports-meet 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup systemd -u $(whoami) --hp $HOME 2>/dev/null || true

echo ""
echo "========================================"
echo "  部署完成！"
echo "  访问地址: http://$(hostname -I | awk '{print $1}'):3000"
echo "  管理员:   admin@hkms.hktedu.com / admin123"
echo ""
echo "  常用命令:"
echo "    pm2 status          查看状态"
echo "    pm2 logs sports-meet 查看日志"
echo "    pm2 restart sports-meet 重启服务"
echo "========================================"
