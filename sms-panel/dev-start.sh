#!/bin/bash

# SMS Panel - Local Development Script
# Test için local ortamda çalıştırın

set -e

echo "╔════════════════════════════════════════════╗"
echo "║   SMS PANEL - DEVELOPMENT ORTAMI           ║"
echo "╚════════════════════════════════════════════╝"
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_info() { echo -e "${YELLOW}→ $1${NC}"; }

# Backend dizinine git
cd "$(dirname "$0")/backend"

# .env kontrolü
if [ ! -f ".env" ]; then
    log_info ".env dosyası oluşturuluyor..."
    cat > .env << EOF
MONGODB_URI=mongodb://localhost:27017/sms-panel-dev
JWT_SECRET=$(openssl rand -base64 32)
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
EOF
    log_success ".env oluşturuldu"
fi

# MongoDB kontrolü
if ! pgrep -x mongod > /dev/null; then
    log_info "MongoDB başlatılıyor..."
    sudo systemctl start mongod || mongod --fork --logpath /var/log/mongodb.log
fi

# Node modules kontrolü
if [ ! -d "node_modules" ]; then
    log_info "Bağımlılıklar yükleniyor..."
    npm install
fi

log_success "Development ortamı hazır!"
echo ""
echo "Backend başlatılıyor..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Backend'i başlat
npm run dev || node server.js
