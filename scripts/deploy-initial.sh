#!/bin/bash
###############################################################################
# Initial Deployment Script
# İlk kurulum için tüm sistemi baştan başlatır
###############################################################################

set -e  # Hata olursa dur

echo "🚀 Ring Panel - İlk Deployment Başlatılıyor..."
echo "================================================"
echo ""

# 1. Proje dizinine git
echo "📁 Proje dizinine gidiliyor..."
cd /root/sms-project
echo "   ✅ Dizin: $(pwd)"
echo ""

# 2. Git pull
echo "📥 Git güncellemeleri çekiliyor..."
git fetch origin
git pull origin claude/user-panel-messaging-notifications-014SmdxrfJ9Q4o4EwwKcu6hc
echo "   ✅ Git güncellemeleri alındı"
echo ""

# 3. Backend dependencies
echo "📦 Backend bağımlılıkları kuruluyor..."
cd sms-panel/backend
npm install
echo "   ✅ Backend dependencies kuruldu"
echo ""

# 4. Database reset
echo "🗑️  Veritabanı sıfırlanıyor..."
node scripts/reset-database.js
echo "   ✅ Veritabanı sıfırlandı"
echo ""

# 5. PM2'de backend'i başlat/restart
echo "🔄 Backend PM2'de başlatılıyor..."
if pm2 describe sms-panel-backend > /dev/null 2>&1; then
  echo "   ℹ️  PM2 process mevcut, restart ediliyor..."
  pm2 restart sms-panel-backend
else
  echo "   ℹ️  PM2 process yok, yeni başlatılıyor..."
  pm2 start server.js --name sms-panel-backend
  pm2 save
fi
echo "   ✅ Backend başlatıldı"
echo ""

# 6. Nginx reload
echo "🌐 Nginx reload ediliyor..."
nginx -t && systemctl reload nginx
echo "   ✅ Nginx reload edildi"
echo ""

# 7. Durum kontrolü
echo "📊 Sistem Durumu:"
echo "================================================"
pm2 list
echo ""

echo "✅ Deployment tamamlandı!"
echo ""
echo "🔗 Erişim Bilgileri:"
echo "   Login: http://158.220.101.218/login.html"
echo "   Admin Panel: http://158.220.101.218/admin-panel.html"
echo "   User Panel: http://158.220.101.218/user-panel.html"
echo ""
echo "👤 Admin Kullanıcısı:"
echo "   Username: admin"
echo "   Password: admin123"
echo ""
echo "📋 Logları görüntülemek için:"
echo "   pm2 logs sms-panel-backend"
echo ""
