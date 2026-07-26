# Aurela — Deployment on Hostinger VPS (Docker + Nginx + SSL)

Domain: **www.aurelawallet.com**

## 0. Prerequisites

- A Hostinger VPS (Ubuntu 22.04 / 24.04 recommended)
- Root or sudo SSH access
- Domain `aurelawallet.com` in Hostinger DNS with:
  - `A` record: `@` → your VPS public IPv4
  - `A` record: `www` → your VPS public IPv4
- Ports 80 and 443 open in Hostinger VPS firewall

## 1. Copy the source to your VPS

On your local machine (or from this preview environment):

```bash
scp -r /app root@YOUR_VPS_IP:/opt/aurela
# OR use git push + git clone on the VPS
```

## 2. Install Docker on the VPS

```bash
ssh root@YOUR_VPS_IP
apt update && apt -y upgrade
curl -fsSL https://get.docker.com | sh
apt -y install docker-compose-plugin
systemctl enable --now docker
```

## 3. Files to create in `/opt/aurela`

Three files are already provided in this repo under `/deploy/`:
- `Dockerfile` — production Next.js build
- `docker-compose.yml` — Next.js + MongoDB + Nginx + Certbot
- `nginx/aurela.conf` — reverse proxy + HTTPS

Copy them next to your Aurela code:

```bash
cd /opt/aurela
cp deploy/Dockerfile .
cp deploy/docker-compose.yml .
mkdir -p nginx && cp deploy/nginx/aurela.conf nginx/aurela.conf
```

## 4. Configure environment for production

Edit `/opt/aurela/.env`:

```bash
MONGO_URL=mongodb://mongo:27017
DB_NAME=aurela
NEXT_PUBLIC_BASE_URL=https://www.aurelawallet.com
CORS_ORIGINS=https://www.aurelawallet.com
AURELA_JWT_SECRET=CHANGE-THIS-TO-A-LONG-RANDOM-STRING
```

⚠️ **Change `AURELA_JWT_SECRET`** to a long random string (`openssl rand -hex 48`).

## 5. First boot (HTTP only, to obtain the SSL certificate)

```bash
cd /opt/aurela
docker compose up -d mongo web
# wait ~30s for Next.js to build/start
docker compose logs -f web    # Ctrl+C when you see "Ready"
docker compose up -d nginx
```

Check `http://www.aurelawallet.com` → should show Aurela landing.

## 6. Get SSL certificate

```bash
docker compose run --rm certbot certonly --webroot -w /var/www/certbot \
    -d aurelawallet.com -d www.aurelawallet.com \
    --email admin@aurelawallet.com --agree-tos --no-eff-email
```

Then enable the HTTPS server block and reload nginx:

```bash
sed -i 's/#SSL#//g' nginx/aurela.conf
docker compose restart nginx
```

Done. Visit **https://www.aurelawallet.com**.

## 7. Auto-renew SSL

Add to crontab (`crontab -e`):

```
0 3 * * * cd /opt/aurela && docker compose run --rm certbot renew --quiet && docker compose restart nginx
```

## 8. Everyday operations

```bash
# View logs
docker compose logs -f web

# Restart
docker compose restart web

# Update code + redeploy
cd /opt/aurela
git pull       # or rsync new files
docker compose build web
docker compose up -d web

# Backup MongoDB
docker compose exec mongo mongodump --archive=/data/db/backup-$(date +%F).gz --gzip
```

## 9. First login

- Public site: https://www.aurelawallet.com
- Admin console: sign in with the seeded super admin
  - Email: `admin@aurela.io`
  - Password: `Admin@123`
- **Change this password immediately** from Profile after first login, and consider seeding your own credentials by editing `ensureSeed()` in `/app/app/api/[[...path]]/route.js`.
