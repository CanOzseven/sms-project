#!/bin/bash

###############################################################################
# SMS Panel - Start Script
# Tüm servisleri başlatır (Backend + Frontend)
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
echo "║       SMS PANEL - START SCRIPT            ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# Root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/sms-panel/backend"
FRONTEND_DIR="$PROJECT_ROOT/sms-panel/frontend"

###############################################################################
# 1. ARKA PLAN (BACKEND) SERVİSİNİ BAŞLAT
###############################################################################

echo -e "${YELLOW}[1/2] Backend servisi başlatılıyor...${NC}"

if [ ! -d "$BACKEND_DIR" ]; then
  echo -e "${RED}HATA: Backend dizini bulunamadı: $BACKEND_DIR${NC}"
  exit 1
fi

cd "$BACKEND_DIR"

# .env dosyası kontrolü
if [ ! -f ".env" ]; then
  echo -e "${YELLOW}⚠️  .env dosyası bulunamadı. .env.example'dan oluşturuluyor...${NC}"
  if [ -f ".env.example" ]; then
    cp .env.example .env
    echo -e "${GREEN}✓ .env dosyası oluşturuldu. Lütfen düzenleyin!${NC}"
  else
    echo -e "${RED}HATA: .env.example dosyası da bulunamadı!${NC}"
    exit 1
  fi
fi

# Node modules kontrolü
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}⚠️  node_modules bulunamadı. npm install çalıştırılıyor...${NC}"
  npm install
  echo -e "${GREEN}✓ Bağımlılıklar kuruldu${NC}"
fi

# MongoDB kontrolü
echo -e "${BLUE}ℹ️  MongoDB bağlantısı kontrol ediliyor...${NC}"
if ! pgrep -x "mongod" > /dev/null; then
  echo -e "${YELLOW}⚠️  MongoDB çalışmıyor olabilir. Lütfen MongoDB'nin çalıştığından emin olun.${NC}"
fi

# Backend'i başlat (detached mode)
echo -e "${GREEN}✓ Backend başlatılıyor (Port: 3000)...${NC}"
npm start > /dev/null 2>&1 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend başlatıldı (PID: $BACKEND_PID)${NC}"

# PID'yi kaydet
echo $BACKEND_PID > "$PROJECT_ROOT/.backend.pid"

# Backend'in hazır olmasını bekle
echo -e "${BLUE}⏳ Backend'in hazır olması bekleniyor...${NC}"
sleep 3

# Health check
if curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo -e "${GREEN}✓ Backend sağlıklı bir şekilde çalışıyor!${NC}"
else
  echo -e "${YELLOW}⚠️  Backend yanıt vermiyor, ama başlatıldı. Logları kontrol edin.${NC}"
fi

###############################################################################
# 2. ÖN YÜZ (FRONTEND) SERVİSİNİ BAŞLAT
###############################################################################

echo -e "\n${YELLOW}[2/2] Frontend servisi başlatılıyor...${NC}"

if [ ! -d "$FRONTEND_DIR" ]; then
  echo -e "${RED}HATA: Frontend dizini bulunamadı: $FRONTEND_DIR${NC}"
  exit 1
fi

cd "$FRONTEND_DIR"

# Python HTTP server ile frontend'i başlat
echo -e "${GREEN}✓ Frontend başlatılıyor (Port: 8080)...${NC}"

# Python3 öncelikli, yoksa python2
if command -v python3 &> /dev/null; then
  python3 -m http.server 8080 > /dev/null 2>&1 &
  FRONTEND_PID=$!
elif command -v python &> /dev/null; then
  python -m SimpleHTTPServer 8080 > /dev/null 2>&1 &
  FRONTEND_PID=$!
else
  echo -e "${RED}HATA: Python bulunamadı! Frontend başlatılamadı.${NC}"
  echo -e "${YELLOW}Alternatif: 'npx http-server -p 8080' kullanabilirsiniz.${NC}"
  FRONTEND_PID=""
fi

if [ -n "$FRONTEND_PID" ]; then
  echo -e "${GREEN}✓ Frontend başlatıldı (PID: $FRONTEND_PID)${NC}"
  echo $FRONTEND_PID > "$PROJECT_ROOT/.frontend.pid"
fi

###############################################################################
# ÖZET
###############################################################################

echo -e "\n${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       TÜM SERVİSLER BAŞLATILDI! ✓         ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}📍 Servis Durumu:${NC}"
echo -e "  ${GREEN}✓${NC} Backend:  http://localhost:3000  (PID: $BACKEND_PID)"
if [ -n "$FRONTEND_PID" ]; then
  echo -e "  ${GREEN}✓${NC} Frontend: http://localhost:8080  (PID: $FRONTEND_PID)"
else
  echo -e "  ${YELLOW}⚠${NC} Frontend: Manuel olarak başlatın"
fi
echo ""
echo -e "${BLUE}🎯 Panel Erişim:${NC}"
echo -e "  • Admin Panel: ${GREEN}http://localhost:8080/admin-panel.html${NC}"
echo -e "  • User Panel:  ${GREEN}http://localhost:8080/user-panel.html${NC}"
echo ""
echo -e "${BLUE}🛠️  Komutlar:${NC}"
echo -e "  • Servisleri durdurmak için: ${YELLOW}./stop.sh${NC}"
echo -e "  • Güncellemek için:          ${YELLOW}./update.sh${NC}"
echo -e "  • Logları görmek için:       ${YELLOW}tail -f sms-panel/backend/logs/*.log${NC}"
echo ""
echo -e "${GREEN}İyi çalışmalar! 🚀${NC}"
