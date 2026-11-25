#!/usr/bin/env bash
# ==============================================================================
# JAMES BILLING - Installer otomatis untuk VM / VPS baru (Ubuntu / Debian)
#
# Pemakaian:
#   ./install.sh              # instal lengkap (aman dijalankan ulang)
#   ./install.sh --update     # tarik kode terbaru, migrasi DB, build, restart
#
# Dari VM kosong (tanpa clone manual):
#   curl -fsSL <URL-RAW-install.sh> | sudo bash
#   (repo akan di-clone ke /opt/james-billing; set REPO_URL bila perlu)
#
# Variabel opsional (environment):
#   REPO_URL      URL git repo (default: https://github.com/azrilsproject/jamesnet-billing.git)
#   INSTALL_DIR   Lokasi instalasi saat clone otomatis (default: /opt/james-billing)
#   APP_PORT      Port aplikasi (default: 3000)
#   ADMIN_PASSWORD  Password awal admin (default: admin123)
#   RESTORE_DUMP  1 = restore db/dump.sql bila DB masih kosong (default: 0)
# ==============================================================================

set -Eeuo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

REPO_URL="${REPO_URL:-https://github.com/azrilsproject/jamesnet-billing.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/james-billing}"
APP_PORT="${APP_PORT:-3000}"
RESTORE_DUMP="${RESTORE_DUMP:-0}"
APP_NAME="james-billing"
DB_NAME="james_billing"
DB_USER="james_billing"
MODE="install"
[ "${1:-}" = "--update" ] && MODE="update"

export DEBIAN_FRONTEND=noninteractive

log()  { echo -e "\n${BLUE}${BOLD}==> $*${NC}"; }
ok()   { echo -e "${GREEN}✔ $*${NC}"; }
warn() { echo -e "${YELLOW}! $*${NC}"; }
die()  { echo -e "${RED}[ERROR] $*${NC}" >&2; exit 1; }
trap 'echo -e "${RED}[ERROR] Instalasi gagal di baris $LINENO. Perbaiki lalu jalankan ulang ./install.sh (aman diulang).${NC}" >&2' ERR

[ -t 1 ] && command -v clear >/dev/null 2>&1 && clear || true
echo -e "${CYAN}${BOLD}"
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║             JAMES BILLING - SERVER INSTALLER               ║"
echo "  ║        PPPoE MikroTik Billing & Isolir Management          ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# ---------------------------------------------------------------- helper root
if [ "$EUID" -eq 0 ]; then
  SUDO=""
elif command -v sudo >/dev/null 2>&1; then
  SUDO="sudo"
else
  die "Jalankan sebagai root atau install sudo terlebih dahulu."
fi
run_root() { $SUDO "$@"; }
run_pg()   { if [ "$EUID" -eq 0 ]; then su postgres -c "psql -v ON_ERROR_STOP=1 $(printf '%q ' "$@")"; else sudo -u postgres psql -v ON_ERROR_STOP=1 "$@"; fi; }

command -v apt-get >/dev/null 2>&1 || die "Installer ini mendukung Ubuntu/Debian (apt). Untuk OS lain, ikuti langkah manual di README."

# ------------------------------------------------- lokasi kode (clone bila perlu)
SCRIPT_PATH="${BASH_SOURCE[0]:-}"
if [ -n "$SCRIPT_PATH" ] && [ -f "$SCRIPT_PATH" ] && [ -f "$(cd "$(dirname "$SCRIPT_PATH")" && pwd)/package.json" ]; then
  APP_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"
else
  log "Menyiapkan kode aplikasi di ${INSTALL_DIR}"
  run_root apt-get update -y
  run_root apt-get install -y git ca-certificates
  if [ -d "$INSTALL_DIR/.git" ]; then
    git -C "$INSTALL_DIR" pull --ff-only
  else
    run_root mkdir -p "$(dirname "$INSTALL_DIR")"
    run_root git clone "$REPO_URL" "$INSTALL_DIR"
  fi
  run_root chown -R "$(id -un)":"$(id -gn)" "$INSTALL_DIR"
  APP_DIR="$INSTALL_DIR"
fi
cd "$APP_DIR"
ok "Direktori aplikasi: $APP_DIR"

# ------------------------------------------------------------------ mode update
if [ "$MODE" = "update" ]; then
  log "Mode update: menarik kode terbaru"
  [ -d .git ] && git pull --ff-only || warn "Bukan git repo, lewati git pull"
  npm install --no-audit --no-fund
  npm run db:migrate
  npm run build
  pm2 restart "$APP_NAME" --update-env || pm2 start ecosystem.config.cjs
  pm2 save
  ok "Update selesai."
  exit 0
fi

# ------------------------------------------------------------ 1. paket dasar
log "[1/8] Menginstall dependensi sistem dasar"
run_root apt-get update -y
run_root apt-get install -y curl git openssl ca-certificates gnupg lsb-release build-essential

# swap otomatis untuk VM kecil (build Next.js butuh RAM)
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
SWAP_MB=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 1800 ] && [ "$SWAP_MB" -lt 512 ] && [ ! -f /swapfile ]; then
  warn "RAM ${MEM_MB}MB kecil, membuat swap 2GB agar build tidak gagal..."
  run_root fallocate -l 2G /swapfile 2>/dev/null || run_root dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
  run_root chmod 600 /swapfile
  run_root mkswap /swapfile >/dev/null
  run_root swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | run_root tee -a /etc/fstab >/dev/null
  ok "Swap 2GB aktif"
fi

# ------------------------------------------------------------ 2. Node.js
log "[2/8] Memeriksa Node.js (>= 20.9)"
node_ok() {
  command -v node >/dev/null 2>&1 || return 1
  local major minor
  major=$(node -v | sed 's/v//' | cut -d. -f1)
  minor=$(node -v | sed 's/v//' | cut -d. -f2)
  [ "$major" -gt 20 ] || { [ "$major" -eq 20 ] && [ "$minor" -ge 9 ]; }
}
if node_ok; then
  ok "Node.js $(node -v) sudah terpasang"
else
  warn "Menginstall Node.js 22 LTS via NodeSource..."
  if [ -n "$SUDO" ]; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  else
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  fi
  run_root apt-get install -y nodejs
  node_ok || die "Gagal menginstall Node.js >= 20.9"
  ok "Node.js $(node -v) terpasang"
fi

# ------------------------------------------------------------ 3. PostgreSQL
log "[3/8] Memeriksa PostgreSQL"
if ! command -v psql >/dev/null 2>&1; then
  warn "PostgreSQL belum ada, menginstall..."
  run_root apt-get install -y postgresql postgresql-contrib
fi
if command -v systemctl >/dev/null 2>&1; then
  run_root systemctl enable postgresql >/dev/null 2>&1 || true
  run_root systemctl start postgresql || true
fi
# tunggu server siap
for _ in $(seq 1 20); do
  if run_pg -tAc "SELECT 1" >/dev/null 2>&1; then break; fi
  sleep 1
done
run_pg -tAc "SELECT 1" >/dev/null 2>&1 || die "PostgreSQL tidak merespons. Cek: systemctl status postgresql"
ok "PostgreSQL siap"

# ------------------------------------------------------------ 4. database + .env
log "[4/8] Menyiapkan database '${DB_NAME}' dan file .env"
# Pakai ulang password dari .env lama agar instalasi ulang tidak memutus aplikasi
DB_PASS=""
if [ -f .env ]; then
  DB_PASS=$(grep '^DATABASE_URL=' .env | sed -E 's#^DATABASE_URL=postgres(ql)?://[^:]+:([^@]+)@.*#\2#' || true)
  case "$DB_PASS" in DATABASE_URL=*|"") DB_PASS="";; esac
fi
[ -n "$DB_PASS" ] || DB_PASS=$(openssl rand -hex 16)

USER_EXISTS=$(run_pg -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | tr -d '[:space:]')
if [ "$USER_EXISTS" != "1" ]; then
  run_pg -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
else
  run_pg -c "ALTER USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
fi
DB_EXISTS=$(run_pg -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | tr -d '[:space:]')
if [ "$DB_EXISTS" != "1" ]; then
  run_pg -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
fi
run_pg -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" >/dev/null
ok "Database dan user PostgreSQL siap"

if [ ! -f .env ]; then
  cat > .env <<EOF
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
SESSION_SECRET=$(openssl rand -hex 32)
CRON_SECRET=$(openssl rand -hex 16)
SCHEDULER_INTERVAL_MINUTES=10
PORT=${APP_PORT}
EOF
  chmod 600 .env
  ok ".env dibuat dengan secret acak"
else
  ok ".env sudah ada, dipakai apa adanya"
fi

# ------------------------------------------------------------ 5. dependencies
log "[5/8] Menginstall dependencies npm"
npm install --no-audit --no-fund

# ------------------------------------------------------------ 6. skema + seed
log "[6/8] Inisialisasi database"
TABLES=$(PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -tAc \
  "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'" | tr -d '[:space:]')
if [ "$RESTORE_DUMP" = "1" ] && [ "${TABLES:-0}" = "0" ] && [ -s db/dump.sql ]; then
  warn "RESTORE_DUMP=1: merestore db/dump.sql ke database kosong..."
  PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=0 -q -f db/dump.sql >/dev/null
  ok "Dump direstore"
fi
# migrasi idempotent: membuat tabel baru / menaikkan skema (termasuk tabel routers)
npm run db:migrate
# seed: admin default, pengaturan, paket contoh (tidak menimpa data yang ada)
SEED_ADMIN_PASSWORD="${ADMIN_PASSWORD:-admin123}" npm run db:seed
ok "Database siap"

# ------------------------------------------------------------ 7. build
log "[7/8] Build aplikasi (Next.js production)"
npm run build

# ------------------------------------------------------------ 8. PM2
log "[8/8] Menjalankan aplikasi dengan PM2"
if ! command -v pm2 >/dev/null 2>&1; then
  run_root npm install -g pm2
fi
pm2 delete "$APP_NAME" >/dev/null 2>&1 || true
PORT="$APP_PORT" pm2 start ecosystem.config.cjs --update-env
pm2 save
if command -v systemctl >/dev/null 2>&1; then
  run_root env "PATH=$PATH" "$(command -v pm2)" startup systemd -u "$(id -un)" --hp "$HOME" >/dev/null 2>&1 \
    && ok "PM2 otomatis jalan saat VM reboot" || warn "Gagal mengaktifkan pm2 startup (jalankan manual: pm2 startup)"
fi

# firewall: buka port bila ufw aktif
if command -v ufw >/dev/null 2>&1 && run_root ufw status 2>/dev/null | grep -q "Status: active"; then
  run_root ufw allow "${APP_PORT}/tcp" >/dev/null && ok "ufw: port ${APP_PORT} dibuka"
fi

# tunggu aplikasi siap
READY=0
for _ in $(seq 1 30); do
  CODE=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/login" || true)
  if [ "$CODE" = "200" ]; then READY=1; break; fi
  sleep 1
done

SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
SERVER_IP="${SERVER_IP:-localhost}"

echo -e "\n${GREEN}${BOLD}══════════════════════════════════════════════════════════════════${NC}"
if [ "$READY" = "1" ]; then
  echo -e "${GREEN}${BOLD}   INSTALASI JAMES BILLING BERHASIL — aplikasi sudah berjalan${NC}"
else
  echo -e "${YELLOW}${BOLD}   Instalasi selesai, tapi aplikasi belum merespons. Cek: pm2 logs ${APP_NAME}${NC}"
fi
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════════════${NC}"
echo -e "Dashboard : ${CYAN}http://${SERVER_IP}:${APP_PORT}${NC}"
echo -e "Login     : ${YELLOW}admin${NC} / ${YELLOW}${ADMIN_PASSWORD:-admin123}${NC}  (segera ganti di menu Pengaturan)"
echo -e "Direktori : ${APP_DIR}"
echo -e ""
echo -e "Langkah berikutnya: buka menu ${BOLD}Router MikroTik${NC} lalu tambahkan router Anda."
echo -e ""
echo -e "Perintah berguna:"
echo -e "  pm2 status | pm2 logs ${APP_NAME} | pm2 restart ${APP_NAME}"
echo -e "  ./install.sh --update    # tarik kode terbaru, migrasi, build, restart"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════════════${NC}\n"
