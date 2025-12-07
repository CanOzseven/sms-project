#!/bin/bash

# SMS Panel - VDS Kurulum Script'i
# Ubuntu 20.04/22.04/24.04 için

set -e

echo "╔════════════════════════════════════════════╗"
echo "║     SMS PANEL - VDS KURULUM SCRIPTI        ║"
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
    echo "Kullanım: sudo bash install.sh"
    exit 1
fi

# Kurulum dizini
INSTALL_DIR="/root/sms-project"
REPO_URL="https://github.com/CanOzseven/sms-project.git"
BRANCH="claude/fix-veriyor-login-fetch-01DLFeXF7zGqnBMyW7bZ711c"

echo "1. Sistem güncelleniyor..."
apt-get update -qq
apt-get upgrade -y -qq
log_success "Sistem güncellendi"

echo ""
echo "2. Gerekli paketler kuruluyor..."
apt-get install -y -qq curl wget gnupg git ufw
log_success "Temel paketler kuruldu"

# Node.js 20 kurulumu
echo ""
echo "3. Node.js 20 kuruluyor..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y -qq nodejs
    log_success "Node.js $(node -v) kuruldu"
else
    log_warning "Node.js zaten kurulu: $(node -v)"
fi

# MongoDB 7.0 kurulumu
echo ""
echo "4. MongoDB 7.0 kuruluyor..."
if ! command -v mongod &> /dev/null; then
    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt-get update -qq
    apt-get install -y -qq mongodb-org
    systemctl start mongod
    systemctl enable mongod
    log_success "MongoDB kuruldu ve başlatıldı"
else
    log_warning "MongoDB zaten kurulu"
    systemctl start mongod 2>/dev/null || true
fi

# PM2 kurulumu
echo ""
echo "5. PM2 kuruluyor..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2 -q
    log_success "PM2 kuruldu"
else
    log_warning "PM2 zaten kurulu"
fi

# Nginx kurulumu
echo ""
echo "6. Nginx kuruluyor..."
if ! command -v nginx &> /dev/null; then
    apt-get install -y -qq nginx
    systemctl start nginx
    systemctl enable nginx
    log_success "Nginx kuruldu ve başlatıldı"
else
    log_warning "Nginx zaten kurulu"
fi

# Proje klonlama
echo ""
echo "7. SMS Panel indiriliyor..."
if [ -d "$INSTALL_DIR" ]; then
    log_warning "Önceki kurulum kaldırılıyor..."
    pm2 delete sms-panel-backend 2>/dev/null || true
    rm -rf "$INSTALL_DIR"
fi

git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR"
log_success "Proje indirildi"

# Backend kurulumu
echo ""
echo "8. Backend kuruluyor..."
cd "$INSTALL_DIR/sms-panel/backend"
npm install --production -q

# .env oluştur
JWT_SECRET=$(openssl rand -base64 32)
cat > .env << EOF
MONGODB_URI=mongodb://localhost:27017/sms-panel
JWT_SECRET=$JWT_SECRET
PORT=3000
NODE_ENV=production
CORS_ORIGIN=*
EOF

log_success "Backend kuruldu"

# PM2 ile backend başlat
echo ""
echo "9. Backend başlatılıyor..."
pm2 start server.js --name sms-panel-backend
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true
log_success "Backend PM2 ile başlatıldı"

# Nginx yapılandırması
echo ""
echo "10. Nginx yapılandırılıyor..."
SERVER_IP=$(curl -s ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

cat > /etc/nginx/sites-available/sms-panel << EOF
server {
    listen 80;
    server_name $SERVER_IP _;

    # Frontend - Admin Panel
    location / {
        root $INSTALL_DIR/sms-panel/frontend;
        index admin-panel.html;
        try_files \$uri \$uri/ /admin-panel.html;
    }

    # API Proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/sms-panel /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
log_success "Nginx yapılandırıldı"

# Firewall
echo ""
echo "11. Firewall yapılandırılıyor..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
log_success "Firewall yapılandırıldı"

# Özet
echo ""
echo "╔════════════════════════════════════════════╗"
echo "║        KURULUM TAMAMLANDI!                 ║"
echo "╚════════════════════════════════════════════╝"
echo ""
echo "Erişim Adresleri:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Admin Panel:  ${GREEN}http://$SERVER_IP/admin-panel.html${NC}"
echo -e "User Panel:   ${GREEN}http://$SERVER_IP/user-panel.html${NC}"
echo -e "API:          ${GREEN}http://$SERVER_IP/api${NC}"
echo ""
echo "Giriş Bilgileri:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Email:    ${YELLOW}admin@sms-panel.com${NC}"
echo -e "Şifre:    ${YELLOW}admin123${NC}"
echo ""
echo -e "${RED}⚠️  Production'da şifreyi değiştirin!${NC}"
echo ""
echo "Faydalı Komutlar:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "pm2 status          - Servis durumu"
echo "pm2 logs            - Logları görüntüle"
echo "pm2 restart all     - Servisleri yeniden başlat"
echo "systemctl status mongod - MongoDB durumu"
echo ""
