#!/usr/bin/env bash
# 拉最新代码 → 重新构建 → 重启服务。改完代码后在服务器上跑这个就行。
set -euo pipefail

cd "$HOME/kid-checkin"

echo "==> 拉取最新代码"
git pull --ff-only

echo "==> 安装依赖"
npm ci --omit=dev --ignore-scripts
npm install --no-save prisma@7.10.0
npx prisma generate

echo "==> 构建（包含数据库迁移）"
npm run build

echo "==> 重启服务"
sudo systemctl restart kid-checkin
sleep 5

if curl -fsS -o /dev/null http://127.0.0.1:3000/login; then
  echo "✓ 更新完成，服务正常"
else
  echo "✗ 服务异常，看日志：sudo journalctl -u kid-checkin -n 50" >&2
  exit 1
fi
