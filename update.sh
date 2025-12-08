#!/bin/bash

###############################################################################
# SMS Panel - Update Script
# Sistemi günceller ve yeniden başlatır
###############################################################################

set -e  # Hata durumunda çık

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════╗"
echo "║       SMS PANEL - UPDATE SCRIPT           ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# Root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/sms-panel/backend"

###############################################################################
# 1. MEVCUT SERVİSLERİ DURDUR
###############################################################################

echo -e "${YELLOW}[1/4] Mevcut servisler durduruluyor...${NC}"
bash "$PROJECT_ROOT/stop.sh"
sleep 2

###############################################################################
# 2. GIT PULL (OPSIYONEL)
###############################################################################

echo -e "\n${YELLOW}[2/4] Git güncellemeleri kontrol ediliyor...${NC}"
cd "$PROJECT_ROOT"

if [ -d ".git" ]; then
  echo -e "${BLUE}ℹ️  Git deposu algılandı.${NC}"
  read -p "Git pull yapılsın mı? (y/N): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git fetch origin
    CURRENT_BRANCH=$(git branch --show-current)
    echo -e "${BLUE}ℹ️  Mevcut branch: $CURRENT_BRANCH${NC}"
    git pull origin $CURRENT_BRANCH
    echo -e "${GREEN}✓ Git güncellemeleri çekildi${NC}"
  else
    echo -e "${YELLOW}⏭️  Git pull atlandı${NC}"
  fi
else
  echo -e "${YELLOW}⚠️  Git deposu değil, atlanıyor...${NC}"
fi

###############################################################################
# 3. BAĞIMLILIKLARI GÜNCELLE
###############################################################################

echo -e "\n${YELLOW}[3/4] Backend bağımlılıkları güncelleniyor...${NC}"
cd "$BACKEND_DIR"

# package.json değişmiş mi kontrol et
if [ -f "package.json" ]; then
  echo -e "${BLUE}ℹ️  npm install çalıştırılıyor...${NC}"
  npm install
  echo -e "${GREEN}✓ Bağımlılıklar güncellendi${NC}"
else
  echo -e "${RED}HATA: package.json bulunamadı!${NC}"
  exit 1
fi

# Database migration varsa çalıştır (opsiyonel)
if [ -f "migrations/migrate.js" ]; then
  echo -e "${BLUE}ℹ️  Database migration çalıştırılıyor...${NC}"
  node migrations/migrate.js
  echo -e "${GREEN}✓ Migration tamamlandı${NC}"
fi

###############################################################################
# 4. SERVİSLERİ YENİDEN BAŞLAT
###############################################################################

echo -e "\n${YELLOW}[4/4] Servisler yeniden başlatılıyor...${NC}"
cd "$PROJECT_ROOT"
bash "$PROJECT_ROOT/start.sh"

###############################################################################
# ÖZET
###############################################################################

echo -e "\n${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       GÜNCELLEME TAMAMLANDI! ✓            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📝 Güncelleme Özeti:${NC}"
echo -e "  ${GREEN}✓${NC} Servisler durduruldu"
echo -e "  ${GREEN}✓${NC} Git güncellemeleri çekildi (varsa)"
echo -e "  ${GREEN}✓${NC} Bağımlılıklar güncellendi"
echo -e "  ${GREEN}✓${NC} Servisler yeniden başlatıldı"
echo ""
echo -e "${GREEN}Sistem hazır! 🚀${NC}"
