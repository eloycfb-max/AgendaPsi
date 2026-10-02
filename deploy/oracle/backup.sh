#!/usr/bin/env bash
# Backup diário do banco (VACUUM INTO, seguro com servidor ligado)
# e das fotos. Mantém os últimos 14 dias em /var/backups/hmps.
# Instalado pelo setup-oracle.sh via cron (todo dia às 03h).
set -euo pipefail

APP_DIR=/opt/hmps
DB="$APP_DIR/data/agenda.db"
BAK=/var/backups/hmps
MANTER_DIAS=14

NODE=/usr/local/bin/node
[ -x "$NODE" ] || NODE=/usr/bin/node

stamp=$(date +%F)

if [ ! -f "$DB" ]; then
  echo "[$(date '+%F %T')] banco ainda não existe — nada a fazer."
  exit 0
fi

mkdir -p "$BAK"

# Cópia consistente do SQLite sem parar o serviço
"$NODE" -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.argv[1]);
db.exec(\"VACUUM INTO '\" + process.argv[2] + \"'\");
db.close();
" "$DB" "$BAK/agenda-$stamp.db"

# Fotos dos consultórios
if [ -d "$APP_DIR/data/uploads" ]; then
  tar -czf "$BAK/uploads-$stamp.tgz" -C "$APP_DIR/data" uploads 2>/dev/null || true
fi

# Retenção: 14 dias
find "$BAK" -name 'agenda-*.db'  -mtime +"$MANTER_DIAS" -delete 2>/dev/null || true
find "$BAK" -name 'uploads-*.tgz' -mtime +"$MANTER_DIAS" -delete 2>/dev/null || true

echo "[$(date '+%F %T')] backup ok: agenda-$stamp.db ($(du -h "$BAK/agenda-$stamp.db" | cut -f1))"
