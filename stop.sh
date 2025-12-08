#!/bin/bash

###############################################################################
# SMS Panel - Stop Script
# Tüm çalışan servisleri durdurur
###############################################################################

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Banner
echo -e "${BLUE}"
echo "╔═══════════════════════════════════════════╗"
echo "║       SMS PANEL - STOP SCRIPT             ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# Root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

###############################################################################
# BACKEND'İ DURDUR
###############################################################################

echo -e "${YELLOW}[1/2] Backend servisi durduruluyor...${NC}"

if [ -f "$PROJECT_ROOT/.backend.pid" ]; then
  BACKEND_PID=$(cat "$PROJECT_ROOT/.backend.pid")
  if kill -0 $BACKEND_PID 2>/dev/null; then
    kill $BACKEND_PID
    echo -e "${GREEN}✓ Backend durduruldu (PID: $BACKEND_PID)${NC}"
  else
    echo -e "${YELLOW}⚠️  Backend zaten çalışmıyor${NC}"
  fi
  rm "$PROJECT_ROOT/.backend.pid"
else
  echo -e "${YELLOW}⚠️  Backend PID dosyası bulunamadı. Port 3000'deki tüm node prosesler durduruluyor...${NC}"
  pkill -f "node.*server.js" || echo -e "${YELLOW}⚠️  Hiçbir node prosesi bulunamadı${NC}"
fi

###############################################################################
# FRONTEND'İ DURDUR
###############################################################################

echo -e "\n${YELLOW}[2/2] Frontend servisi durduruluyor...${NC}"

if [ -f "$PROJECT_ROOT/.frontend.pid" ]; then
  FRONTEND_PID=$(cat "$PROJECT_ROOT/.frontend.pid")
  if kill -0 $FRONTEND_PID 2>/dev/null; then
    kill $FRONTEND_PID
    echo -e "${GREEN}✓ Frontend durduruldu (PID: $FRONTEND_PID)${NC}"
  else
    echo -e "${YELLOW}⚠️  Frontend zaten çalışmıyor${NC}"
  fi
  rm "$PROJECT_ROOT/.frontend.pid"
else
  echo -e "${YELLOW}⚠️  Frontend PID dosyası bulunamadı. Port 8080'deki python prosesler durduruluyor...${NC}"
  lsof -ti:8080 | xargs kill -9 2>/dev/null || echo -e "${YELLOW}⚠️  Port 8080'de proses bulunamadı${NC}"
fi

###############################################################################
# ÖZET
###############################################################################

echo -e "\n${GREEN}╔═══════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       TÜM SERVİSLER DURDURULDU! ✓         ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}ℹ️  Yeniden başlatmak için: ${YELLOW}./start.sh${NC}"
echo ""
