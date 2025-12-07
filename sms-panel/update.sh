#!/bin/bash

# SMS Panel - VPS Güncelleme Script'i
# Sunucudaki mevcut kurulumu güncellemek için

set -e

echo "╔════════════════════════════════════════════╗"
echo "║     SMS PANEL - GÜNCELLEME SCRIPTI         ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Renk kodları
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonksiyonlar
log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
log_error() { echo -e "${RED}✗ $1${NC}"; }
log_info() { echo -e "→ $1"; }

# Root kontrolü
if [ "$EUID" -ne 0 ]; then
    log_error "Bu script root olarak çalıştırılmalı!"
    echo "Kullanım: sudo bash update.sh"
    exit 1
fi

# Kurulum dizini
INSTALL_DIR="/root/sms-project"

# Dizin kontrolü
if [ ! -d "$INSTALL_DIR" ]; then
    log_error "SMS Panel kurulu değil! Önce install.sh ile kurulum yapın."
    exit 1
fi

cd "$INSTALL_DIR"

echo "1. Mevcut branch kontrol ediliyor..."
CURRENT_BRANCH=$(git branch --show-current)
log_info "Mevcut branch: $CURRENT_BRANCH"

echo ""
echo "2. Değişiklikler çekiliyor..."
git fetch origin
log_success "Değişiklikler getirildi"

echo ""
echo "3. En son kod güncelleniyor..."
git pull origin "$CURRENT_BRANCH"
log_success "Kod güncellendi"

echo ""
echo "4. Backend güncelleniyor..."
cd "$INSTALL_DIR/sms-panel/backend"

# Bağımlılıkları güncelle (eğer package.json değiştiyse)
if git diff HEAD@{1} HEAD --name-only | grep -q "package.json"; then
    log_info "package.json değişti, bağımlılıklar güncelleniyor..."
    npm install --production -q
    log_success "Bağımlılıklar güncellendi"
else
    log_info "package.json değişmedi, bağımlılık güncellemesi atlandı"
fi

echo ""
echo "5. Backend yeniden başlatılıyor..."
pm2 restart sms-panel-backend
log_success "Backend yeniden başlatıldı"

echo ""
echo "6. Frontend kontrol ediliyor..."
# Frontend statik dosyalar, nginx otomatik güncellenmiş dosyaları serve eder
# Nginx cache varsa temizle
if nginx -t 2>/dev/null; then
    systemctl reload nginx
    log_success "Nginx yenilendi"
else
    log_warning "Nginx yapılandırma hatası, kontrol edin"
fi

echo ""
echo "7. Servis durumu kontrol ediliyor..."
pm2 status

echo ""
echo "╔════════════════════════════════════════════╗"
echo "║        GÜNCELLEME TAMAMLANDI!              ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Son Değişiklikler:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
git log -3 --pretty=format:"%h - %s (%cr)" --abbrev-commit
echo ""
echo ""
echo "Faydalı Komutlar:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "pm2 logs sms-panel-backend  - Backend loglarını görüntüle"
echo "pm2 restart sms-panel-backend - Backend'i yeniden başlat"
echo "pm2 monit                   - Canlı monitoring"
echo ""
