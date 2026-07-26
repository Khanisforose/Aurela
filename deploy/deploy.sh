#!/usr/bin/env bash
# Run this script on your Hostinger VPS after uploading /opt/aurela
set -euo pipefail

cd /opt/aurela

echo "==> Installing Docker (if missing)"
if ! command -v docker &>/dev/null; then
  curl -fsSL https://get.docker.com | sh
  apt -y install docker-compose-plugin || true
  systemctl enable --now docker
fi

echo "==> Preparing directories"
mkdir -p nginx certbot/www certbot/conf

echo "==> First boot: HTTP only"
docker compose up -d mongo web
sleep 20
docker compose up -d nginx

echo "==> Requesting SSL cert (make sure DNS A records point to this VPS!)"
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
  -d aurelawallet.com -d www.aurelawallet.com \
  --email admin@aurelawallet.com --agree-tos --no-eff-email --non-interactive

echo "==> Enabling HTTPS in nginx config"
sed -i 's/#SSL#//g' nginx/aurela.conf
docker compose restart nginx

echo "==> Adding cron for auto-renew"
(crontab -l 2>/dev/null | grep -v aurela; echo "0 3 * * * cd /opt/aurela && docker compose run --rm certbot renew --quiet && docker compose restart nginx  # aurela") | crontab -

echo ""
echo "✅ Deployment complete. Visit https://www.aurelawallet.com"
echo "   Super admin: admin@aurelawallet.com / Aurela@123#  (change immediately)"
