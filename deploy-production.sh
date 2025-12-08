#!/bin/bash

###############################################################################
# SMS Panel - Production Deployment Script
# Branch değiştirir, günceller ve production'a deploy eder
###############################################################################

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════╗"
echo "║    PRODUCTION DEPLOYMENT SCRIPT           ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/sms-panel/backend"

# Varsayılan değerler
PRODUCTION_BRANCH="${1:-main}"
BACKUP_ENABLED="${2:-yes}"

echo -e "${BLUE}Deployment Ayarları:${NC}"
echo "  • Production Branch: $PRODUCTION_BRANCH"
echo "  • Backup: $BACKUP_ENABLED"
echo "  • Project Root: $PROJECT_ROOT"
echo ""

###############################################################################
# 1. GIT DURUMU KONTROL ET
###############################################################################

echo -e "${YELLOW}[1/8] Git durumu kontrol ediliyor...${NC}"
cd "$PROJECT_ROOT"

# Uncommitted changes var mı?
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}⚠️  Commit edilmemiş değişiklikler var!${NC}"
  git status --short
  echo ""
  read -p "Devam etmek istiyor musunuz? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Deployment iptal edildi.${NC}"
    exit 1
  fi
fi

CURRENT_BRANCH=$(git branch --show-current)
echo -e "${GREEN}✓ Mevcut branch: $CURRENT_BRANCH${NC}"

###############################################################################
# 2. MEVCUT SERVİSLERİ DURDUR
###############################################################################

echo -e "\n${YELLOW}[2/8] Mevcut servisler durduruluyor...${NC}"
if [ -f "$PROJECT_ROOT/stop.sh" ]; then
  bash "$PROJECT_ROOT/stop.sh" || true
else
  echo -e "${YELLOW}⚠️  stop.sh bulunamadı, manuel olarak durdurulacak...${NC}"
  pkill -f "node.*server.js" || true
  lsof -ti:3000 | xargs kill -9 2>/dev/null || true
  lsof -ti:8080 | xargs kill -9 2>/dev/null || true
fi

echo -e "${GREEN}✓ Servisler durduruldu${NC}"
sleep 2

###############################################################################
# 3. DATABASE BACKUP (OPSIYONEL)
###############################################################################

if [ "$BACKUP_ENABLED" == "yes" ]; then
  echo -e "\n${YELLOW}[3/8] MongoDB backup alınıyor...${NC}"

  BACKUP_DIR="$PROJECT_ROOT/backups"
  mkdir -p "$BACKUP_DIR"

  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="$BACKUP_DIR/sms-panel-backup-$TIMESTAMP"

  # MongoDB backup
  if command -v mongodump &> /dev/null; then
    mongodump --uri="mongodb://localhost:27017/sms-panel" --out="$BACKUP_FILE" --quiet
    echo -e "${GREEN}✓ Backup oluşturuldu: $BACKUP_FILE${NC}"
  else
    echo -e "${YELLOW}⚠️  mongodump bulunamadı, backup atlandı${NC}"
  fi
else
  echo -e "\n${YELLOW}[3/8] Backup devre dışı, atlanıyor...${NC}"
fi

###############################################################################
# 4. PRODUCTION BRANCH'E GEÇ
###############################################################################

echo -e "\n${YELLOW}[4/8] Production branch'e geçiliyor...${NC}"

# Fetch latest
git fetch origin

# Branch'e switch
if [ "$CURRENT_BRANCH" != "$PRODUCTION_BRANCH" ]; then
  echo -e "${BLUE}ℹ️  $CURRENT_BRANCH → $PRODUCTION_BRANCH${NC}"
  git checkout "$PRODUCTION_BRANCH"
else
  echo -e "${BLUE}ℹ️  Zaten $PRODUCTION_BRANCH branch'indesiniz${NC}"
fi

# Pull latest
git pull origin "$PRODUCTION_BRANCH"
echo -e "${GREEN}✓ Branch: $PRODUCTION_BRANCH (güncel)${NC}"

###############################################################################
# 5. BAĞIMLILIKLARI GÜNCELLE
###############################################################################

echo -e "\n${YELLOW}[5/8] Backend bağımlılıkları güncelleniyor...${NC}"
cd "$BACKEND_DIR"

# package.json var mı?
if [ ! -f "package.json" ]; then
  echo -e "${RED}HATA: package.json bulunamadı!${NC}"
  exit 1
fi

# npm install
npm install --production
echo -e "${GREEN}✓ Bağımlılıklar güncellendi${NC}"

###############################################################################
# 6. ORTAM DEĞİŞKENLERİNİ KONTROL ET
###############################################################################

echo -e "\n${YELLOW}[6/8] Ortam değişkenleri kontrol ediliyor...${NC}"

if [ ! -f ".env" ]; then
  echo -e "${RED}⚠️  .env dosyası bulunamadı!${NC}"
  if [ -f ".env.example" ]; then
    echo -e "${BLUE}ℹ️  .env.example kopyalanıyor...${NC}"
    cp .env.example .env
    echo -e "${YELLOW}⚠️  .env dosyasını düzenleyin ve deployment'ı tekrar çalıştırın!${NC}"
    exit 1
  else
    echo -e "${RED}HATA: .env.example da bulunamadı!${NC}"
    exit 1
  fi
fi

# NODE_ENV kontrolü
if ! grep -q "NODE_ENV=production" .env; then
  echo -e "${YELLOW}⚠️  NODE_ENV production değil!${NC}"
  read -p "NODE_ENV=production olarak ayarlansın mı? (Y/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Nn]$ ]]; then
    sed -i 's/NODE_ENV=.*/NODE_ENV=production/' .env || echo "NODE_ENV=production" >> .env
    echo -e "${GREEN}✓ NODE_ENV=production olarak ayarlandı${NC}"
  fi
fi

echo -e "${GREEN}✓ Ortam değişkenleri hazır${NC}"

###############################################################################
# 7. DATABASE MIGRATION (VARSA)
###############################################################################

echo -e "\n${YELLOW}[7/8] Database migration kontrol ediliyor...${NC}"

if [ -d "migrations" ] && [ -f "migrations/migrate.js" ]; then
  echo -e "${BLUE}ℹ️  Migration script bulundu, çalıştırılıyor...${NC}"
  node migrations/migrate.js
  echo -e "${GREEN}✓ Migration tamamlandı${NC}"
else
  echo -e "${BLUE}ℹ️  Migration script yok, atlanıyor${NC}"
fi

###############################################################################
# 8. SERVİSLERİ BAŞLAT
###############################################################################

echo -e "\n${YELLOW}[8/8] Servisler başlatılıyor...${NC}"

# PM2 var mı?
if command -v pm2 &> /dev/null; then
  echo -e "${BLUE}ℹ️  PM2 ile başlatılıyor...${NC}"

  # Eski prosesleri durdur
  pm2 delete sms-panel-backend 2>/dev/null || true
  pm2 delete sms-panel-frontend 2>/dev/null || true

  # Backend'i başlat
  pm2 start server.js --name sms-panel-backend

  # Frontend'i başlat (opsiyonel)
  cd "$PROJECT_ROOT/sms-panel/frontend"
  if command -v python3 &> /dev/null; then
    pm2 start --name sms-panel-frontend --interpreter python3 -- -m http.server 8080
  fi

  # PM2 kaydet
  pm2 save

  echo -e "${GREEN}✓ Servisler PM2 ile başlatıldı${NC}"
  pm2 status

else
  echo -e "${YELLOW}⚠️  PM2 bulunamadı, manuel olarak başlatılıyor...${NC}"

  if [ -f "$PROJECT_ROOT/start.sh" ]; then
    bash "$PROJECT_ROOT/start.sh"
  else
    echo -e "${RED}HATA: start.sh bulunamadı!${NC}"
    echo -e "${YELLOW}Manuel olarak başlatın: cd $BACKEND_DIR && npm start${NC}"
    exit 1
  fi
fi

###############################################################################
# 9. HEALTH CHECK
###############################################################################

echo -e "\n${YELLOW}Health check yapılıyor...${NC}"
sleep 3

# Backend health check
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Backend: http://localhost:3000 (OK)${NC}"
else
  echo -e "${RED}✗ Backend: http://localhost:3000 (FAIL)${NC}"
  echo -e "${YELLOW}⚠️  Logları kontrol edin!${NC}"
fi

# Frontend health check
if curl -s http://localhost:8080 > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Frontend: http://localhost:8080 (OK)${NC}"
else
  echo -e "${YELLOW}⚠️ Frontend: http://localhost:8080 (DOWN)${NC}"
fi

###############################################################################
# ÖZET
###############################################################################

echo -e "\n${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║    DEPLOYMENT BAŞARILI! ✓                 ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 Deployment Özeti:${NC}"
echo "  • Branch: $PRODUCTION_BRANCH"
echo "  • Backend: http://localhost:3000"
echo "  • Frontend: http://localhost:8080"
echo "  • Admin Panel: http://localhost:8080/admin-panel.html"
echo "  • User Panel: http://localhost:8080/user-panel.html"
echo ""
echo -e "${BLUE}📊 Servis Yönetimi:${NC}"
if command -v pm2 &> /dev/null; then
  echo "  • Logları görüntüle: ${CYAN}pm2 logs${NC}"
  echo "  • Servisleri izle: ${CYAN}pm2 monit${NC}"
  echo "  • Servisleri yeniden başlat: ${CYAN}pm2 restart all${NC}"
  echo "  • Servisleri durdur: ${CYAN}pm2 stop all${NC}"
else
  echo "  • Servisleri durdur: ${CYAN}./stop.sh${NC}"
  echo "  • Logları görüntüle: ${CYAN}tail -f sms-panel/backend/logs/*.log${NC}"
fi

if [ "$BACKUP_ENABLED" == "yes" ] && [ -d "$BACKUP_FILE" ]; then
  echo ""
  echo -e "${BLUE}💾 Backup:${NC}"
  echo "  • Konum: $BACKUP_FILE"
  echo "  • Geri yükle: ${CYAN}mongorestore --uri='mongodb://localhost:27017/sms-panel' --drop $BACKUP_FILE/sms-panel${NC}"
fi

echo ""
echo -e "${GREEN}Production'da başarılı! 🚀${NC}"
