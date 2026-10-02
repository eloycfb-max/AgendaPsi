#!/usr/bin/env bash
# =============================================================
# HumanaMentePsi — instalação completa em VM Oracle Cloud Always Free
# (Ubuntu 24.04). Idempotente: pode rodar de novo para atualizar.
#
#   curl -fsSL https://raw.githubusercontent.com/eloycfb-max/AgendaPsi/main/deploy/oracle/setup-oracle.sh -o setup.sh
#   sudo bash setup.sh
# =============================================================
set -euo pipefail

APP_DIR=/opt/hmps
REPO=https://github.com/eloycfb-max/AgendaPsi.git
APP_USER=hmps
APP_PORT=3000

if [ "$(id -u)" -ne 0 ]; then
  echo "ERRO: rode com sudo (ex.: sudo bash setup.sh)."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "==> [1/8] Atualizando pacotes do sistema"
apt-get update -y
apt-get install -y curl ca-certificates git nginx ufw jq xz-utils

echo "==> [2/8] Node.js 24 (node:sqlite exige >= 24)"
tem_node24() {
  command -v node >/dev/null 2>&1 &&
    [ "$(node -e 'process.stdout.write(process.versions.node.split(".")[0])' 2>/dev/null)" -ge 24 ]
}
if ! tem_node24; then
  instalou_nodesource=0
  if curl -fsSL https://deb.nodesource.com/setup_24.x -o /tmp/nodesource_setup.sh; then
    bash /tmp/nodesource_setup.sh && instalou_nodesource=1 || true
  fi
  if [ "$instalou_nodesource" -eq 1 ]; then
    apt-get install -y nodejs
  fi
  if ! tem_node24; then
    echo "    NodeSource indisponível — usando binário oficial do nodejs.org"
    ARCH=$(dpkg --print-architecture) # arm64 ou amd64
    BASE="https://nodejs.org/dist/latest-v24.x/"
    ARQUIVO=$(curl -fsSL "$BASE" | grep -o "node-v24[^\"]*linux-${ARCH}.tar.xz" | head -n1)
    if [ -z "$ARQUIVO" ]; then
      echo "ERRO: não consegui baixar o Node 24 (${ARCH})."; exit 1
    fi
    curl -fsSL "${BASE}${ARQUIVO}" -o /tmp/node.tar.xz
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1
    hash -r
  fi
fi
node -v
npm -v

echo "==> [3/8] Usuário do aplicativo e código-fonte"
id -u "$APP_USER" >/dev/null 2>&1 || useradd -m -s /bin/bash "$APP_USER"
if [ ! -d "$APP_DIR/.git" ]; then
  git clone "$REPO" "$APP_DIR"
fi
chown -R "$APP_USER:$APP_USER" "$APP_DIR"

echo "==> [4/8] Senha inicial do painel (gerada 1 vez, preservada)"
ENV_FILE="$APP_DIR/.env"
if ! grep -q '^ADMIN_SENHA_INICIAL=' "$ENV_FILE" 2>/dev/null; then
  SENHA=$(node -e 'process.stdout.write(require("crypto").randomBytes(18).toString("base64url"))')
  echo "ADMIN_SENHA_INICIAL=$SENHA" >> "$ENV_FILE"
  SENHA_GERADA="$SENHA"
else
  SENHA_GERADA="(já existente no .env)"
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

echo "==> [5/8] Dependências e build de produção"
sudo -u "$APP_USER" env HOME="/home/$APP_USER" bash -lc "cd '$APP_DIR' && npm ci && npm run build"

echo "==> [6/8] Serviço (PM2) com reinício automático"
if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi
sudo -u "$APP_USER" env HOME="/home/$APP_USER" bash -lc "cd '$APP_DIR' && pm2 delete agenda >/dev/null 2>&1 || true; pm2 start npm --name agenda --cwd '$APP_DIR' -- start && pm2 save"
pm2 startup systemd -u "$APP_USER" --hp "/home/$APP_USER" >/dev/null 2>&1 || true

echo "==> [7/8] Nginx (porta 80 -> app na ${APP_PORT})"
cat > /etc/nginx/sites-available/hmps <<'NGINX'
server {
    listen 80 default_server;
    server_name _;
    client_max_body_size 20m;   # upload de fotos dos consultórios

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 90s;
    }
}
NGINX
ln -sf /etc/nginx/sites-available/hmps /etc/nginx/sites-enabled/hmps
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
systemctl enable nginx >/dev/null

echo "==> [8/8] Firewall local + backup diário"
ufw allow 22/tcp >/dev/null 2>&1 || true
ufw allow 80/tcp >/dev/null 2>&1 || true
ufw allow 443/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

chmod +x "$APP_DIR/deploy/oracle/backup.sh"
mkdir -p /var/backups/hmps /var/log
(crontab -l 2>/dev/null | grep -v 'deploy/oracle/backup.sh'; \
 echo "0 3 * * * /opt/hmps/deploy/oracle/backup.sh >> /var/log/hmps-backup.log 2>&1") | crontab -

sleep 5
IP=$(curl -s --max-time 5 -H 'Authorization: Bearer Oracle' \
  http://169.254.169.254/opc/v2/instance/publicIp 2>/dev/null || true)
IP=${IP:-<IP-publico-da-VM>}

echo ""
echo "=========================================================="
echo "  INSTALAÇÃO CONCLUÍDA"
echo "=========================================================="
echo "  Site:    http://${IP}/"
echo "  Agenda:  http://${IP}/agenda"
echo "  Painel:  http://${IP}/login"
echo "  E-mail:  admin@humamentepsi.com"
echo "  Senha:   ${SENHA_GERADA}"
echo ""
echo "  Guarde a senha acima. Se o site não abrir, confira"
echo "  se as portas 80/443 estão liberadas na Security List"
echo "  da VCN (guia: docs/DEPLOY.md, passo 5)."
echo "=========================================================="
