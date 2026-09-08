#!/usr/bin/env bash
# 在 Oracle Cloud 的 Ubuntu ARM 机器上一次性初始化整套服务。
#
#   在服务器上执行：
#     cd ~/kid-checkin && bash deploy/setup.sh
#
# 跑之前需要准备好两样东西（脚本会检查）：
#   1. ~/kid-checkin/.env          —— DATABASE_URL、SESSION_SECRET
#   2. ~/kid-checkin/deploy/duckdns.env —— DUCKDNS_SUBDOMAIN、DUCKDNS_TOKEN、SITE_DOMAIN
#
# 重复执行是安全的（幂等）。
set -euo pipefail

APP_DIR="$HOME/kid-checkin"
DUCK_ENV="$APP_DIR/deploy/duckdns.env"

step() { echo -e "\n\033[1;36m==> $*\033[0m"; }
die() { echo -e "\033[1;31m✗ $*\033[0m" >&2; exit 1; }

[ -f "$APP_DIR/.env" ] || die "缺少 $APP_DIR/.env（需要 DATABASE_URL 和 SESSION_SECRET）"
[ -f "$DUCK_ENV" ] || die "缺少 $DUCK_ENV（需要 DUCKDNS_SUBDOMAIN / DUCKDNS_TOKEN / SITE_DOMAIN）"
# shellcheck disable=SC1090
source "$DUCK_ENV"
[ -n "${SITE_DOMAIN:-}" ] || die "duckdns.env 里没有 SITE_DOMAIN"

step "1/7 安装系统依赖（Node.js 24、Caddy、防火墙工具）"
sudo apt-get update -qq
sudo apt-get install -y curl ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https

if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
echo "Node: $(node -v)"

if ! command -v caddy >/dev/null; then
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y caddy
fi
echo "Caddy: $(caddy version)"

step "2/7 放行 80/443 端口"
# Oracle 的 Ubuntu 镜像默认 iptables 是全封的，除了 22。
# 注意：云控制台那边的「安全列表/网络安全组」也要放行，脚本管不到，见 deploy/README.md。
sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || \
  sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save >/dev/null 2>&1 || sudo apt-get install -y iptables-persistent

step "3/7 安装依赖并构建"
cd "$APP_DIR"
npm ci --omit=dev --ignore-scripts
npm install --no-save prisma@7.10.0    # 构建阶段要跑 prisma generate / migrate deploy
npx prisma generate
npm run build

step "4/7 配置 DuckDNS 自动更新"
sudo cp deploy/duckdns.service deploy/duckdns.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now duckdns.timer
sudo systemctl start duckdns.service
echo "已把 $DUCKDNS_SUBDOMAIN.duckdns.org 指向本机公网 IP"

step "5/7 配置 Caddy（自动 HTTPS）"
sudo mkdir -p /etc/caddy
echo "SITE_DOMAIN=$SITE_DOMAIN" | sudo tee /etc/caddy/caddy.env >/dev/null
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile
# 让 caddy 服务能读到 SITE_DOMAIN
sudo mkdir -p /etc/systemd/system/caddy.service.d
printf '[Service]\nEnvironmentFile=/etc/caddy/caddy.env\n' \
  | sudo tee /etc/systemd/system/caddy.service.d/override.conf >/dev/null
sudo systemctl daemon-reload
sudo systemctl enable caddy
sudo systemctl restart caddy

step "6/7 注册应用为开机自启服务"
sudo cp deploy/kid-checkin.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now kid-checkin
sleep 3
sudo systemctl restart kid-checkin

step "7/7 自检"
sleep 5
if curl -fsS -o /dev/null http://127.0.0.1:3000/login; then
  echo "✓ 应用本地响应正常"
else
  die "应用没起来，看日志：sudo journalctl -u kid-checkin -n 50"
fi

echo -e "\n\033[1;32m部署完成！\033[0m"
echo "外网地址： https://$SITE_DOMAIN"
echo
echo "常用命令："
echo "  查看应用日志   sudo journalctl -u kid-checkin -f"
echo "  查看 Caddy 日志 sudo journalctl -u caddy -f"
echo "  重启应用       sudo systemctl restart kid-checkin"
echo "  更新代码       cd ~/kid-checkin && bash deploy/update.sh"
