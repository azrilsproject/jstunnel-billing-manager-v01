#!/usr/bin/env bash
# ==============================================================================
# JAMES BILLING - Automated Server Installer & Setup Script
# Target: Ubuntu / Debian / Linux VPS
# ==============================================================================

set -e

# Warna output terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

clear
echo -e "${CYAN}${BOLD}"
echo "  ╔════════════════════════════════════════════════════════════╗"
echo "  ║             JAMES BILLING - SERVER INSTALLER               ║"
echo "  ║        PPPoE MikroTik Billing & Isolir Management          ║"
echo "  ╚════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Cek hak akses sudo / root
SUDO=""
if [ "$EUID" -ne 0 ]; then
  if command -v sudo >/dev/null 2>&1; then
    SUDO="sudo"
  else
    echo -e "${RED}[ERROR] Script membutuhkan akses root atau sudo.${NC}"
    exit 1
  fi
fi

# 2. Update paket & instalasi dasar (curl, git, openssl)
echo -e "\n${BLUE}==> [1/7] Memeriksa & Menginstall dependensi sistem dasar...${NC}"
if command -v apt-get >/dev/null 2>&1; then
  $SUDO apt-get update -y
  $SUDO apt-get install -y curl git openssl ca-certificates gnupg lsb-release
fi

# 3. Instalasi Node.js (v20 LTS) jika belum terpasang atau versi terlalu lama
echo -e "\n${BLUE}==> [2/7] Memeriksa instalasi Node.js & npm...${NC}"
NODE_OK=0
if command -v node >/dev/null 2>&1; then
  NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
  if [ "$NODE_VER" -ge 20 ]; then
    NODE_OK=1
    echo -e "${GREEN}✔ Node.js $(node -v) sudah terpasang.${NC}"
  fi
fi

if [ "$NODE_OK" -eq 0 ]; then
  echo -e "${YELLOW}Menginstall Node.js 20.x LTS via NodeSource...${NC}"
  if command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO -E bash -
    $SUDO apt-get install -y nodejs
  else
    echo -e "${RED}[ERROR] Silakan install Node.js versi >= 20 secara manual.${NC}"
    exit 1
  fi
fi

# 4. Instalasi & Setup PostgreSQL
echo -e "\n${BLUE}==> [3/7] Memeriksa instalasi PostgreSQL...${NC}"
if ! command -v psql >/dev/null 2>&1; then
  echo -e "${YELLOW}PostgreSQL belum ditemukan, melakukan instalasi...${NC}"
  if command -v apt-get >/dev/null 2>&1; then
    $SUDO apt-get install -y postgresql postgresql-contrib
  fi
fi

# Pastikan service postgresql aktif
if command -v systemctl >/dev/null 2>&1; then
  $SUDO systemctl enable postgresql || true
  $SUDO systemctl start postgresql || true
fi

# Setup Database & User PostgreSQL
DB_NAME="james_billing"
DB_USER="james_billing"
DB_PASS=$(openssl rand -hex 12)

echo -e "\n${BLUE}==> [4/7] Mengonfigurasi database PostgreSQL '${DB_NAME}'...${NC}"
if command -v su >/dev/null 2>&1 && id postgres >/dev/null 2>&1; then
  # Buat user & db jika belum ada
  $SUDO -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
    $SUDO -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"

  $SUDO -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
    $SUDO -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

  $SUDO -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" >/dev/null 2>&1 || true
  $SUDO -u postgres psql -d ${DB_NAME} -c "GRANT ALL ON SCHEMA public TO ${DB_USER};" >/dev/null 2>&1 || true
  echo -e "${GREEN}✔ Database PostgreSQL '${DB_NAME}' siap.${NC}"
else
  echo -e "${YELLOW}PostgreSQL service non-standar, pastikan database '${DB_NAME}' sudah ada.${NC}"
fi

# 5. Konfigurasi file .env
echo -e "\n${BLUE}==> [5/7] Mengonfigurasi file .env...${NC}"
if [ ! -f .env ]; then
  SESSION_SECRET=$(openssl rand -hex 32)
  CRON_SECRET=$(openssl rand -hex 16)
  DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}"

  cat <<EOF > .env
DATABASE_URL=${DATABASE_URL}
SESSION_SECRET=${SESSION_SECRET}
CRON_SECRET=${CRON_SECRET}
SCHEDULER_INTERVAL_MINUTES=10
PORT=3000
EOF
  echo -e "${GREEN}✔ File .env baru berhasil dibuat dengan secret acak yang aman.${NC}"
else
  echo -e "${GREEN}✔ File .env sudah ada, menggunakan konfigurasi yang tersimpan.${NC}"
fi

# 6. Install dependencies npm & migrasi database
echo -e "\n${BLUE}==> [6/7] Menginstall paket dependencies & inisialisasi database...${NC}"
npm install

# Cek apakah ada file dump.sql untuk restore, jika tidak jalankan db:setup
if [ -f "db/dump.sql" ] && [ -s "db/dump.sql" ]; then
  echo -e "${YELLOW}Ditemukan db/dump.sql, melakukan restore database...${NC}"
  # Ambil DATABASE_URL dari .env
  DB_CONN=$(grep '^DATABASE_URL=' .env | cut -d'=' -f2-)
  if [ -n "$DB_CONN" ]; then
    # Jika gagal dengan DATABASE_URL, coba fallback ke psql postgres
    psql "$DB_CONN" < db/dump.sql 2>/dev/null || \
      ($SUDO -u postgres psql -d ${DB_NAME} < db/dump.sql 2>/dev/null || npm run db:setup)
  else
    npm run db:setup
  fi
  echo -e "${GREEN}✔ Database berhasil dimigrasi & direstore.${NC}"
else
  npm run db:setup
fi

# 7. Build aplikasi Next.js
echo -e "\n${BLUE}==> [7/7] Membangun aplikasi (Next.js Production Build)...${NC}"
npm run build

# 8. PM2 Setup (Process Manager)
echo -e "\n${BLUE}==> Menyiapkan PM2 Process Manager...${NC}"
if ! command -v pm2 >/dev/null 2>&1; then
  echo -e "${YELLOW}Menginstall PM2 secara global...${NC}"
  $SUDO npm install -g pm2
fi

pm2 delete james-billing 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

if command -v systemctl >/dev/null 2>&1; then
  pm2 startup | tail -n 1 | $SUDO bash 2>/dev/null || true
fi

# Ambil IP server publik/lokal
SERVER_IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$SERVER_IP" ]; then
  SERVER_IP="localhost"
fi

echo -e "\n${GREEN}${BOLD}══════════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}${BOLD}       🎉 INSTALASI JAMES BILLING BERHASIL DI SERVER!             ${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════════════${NC}"
echo -e "Aplikasi saat ini berjalan di latar belakang (background) via PM2."
echo -e ""
echo -e "🌐 ${BOLD}Akses Web Dashboard:${NC}"
echo -e "   • URL Lokal   : ${CYAN}http://localhost:3000${NC}"
echo -e "   • URL Server  : ${CYAN}http://${SERVER_IP}:3000${NC}"
echo -e ""
echo -e "🔑 ${BOLD}Login Default Administrator:${NC}"
echo -e "   • Username    : ${YELLOW}admin${NC}"
echo -e "   • Password    : ${YELLOW}admin123${NC}"
echo -e "   ${CYAN}(Harap segera ganti password di menu Pengaturan!)${NC}"
echo -e ""
echo -e "🛠️ ${BOLD}Perintah Pengelolaan (PM2):${NC}"
echo -e "   • Cek status  : ${BOLD}pm2 status${NC}"
echo -e "   • Lihat logs  : ${BOLD}pm2 logs james-billing${NC}"
echo -e "   • Restart app : ${BOLD}pm2 restart james-billing${NC}"
echo -e "   • Stop app    : ${BOLD}pm2 stop james-billing${NC}"
echo -e "${GREEN}${BOLD}══════════════════════════════════════════════════════════════════${NC}\n"
