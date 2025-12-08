#!/bin/bash
###############################################################################
# Update Deployment Script
# Kod güncellemelerini deploy eder (veritabanını sıfırlamaz)
###############################################################################

set -e  # Hata olursa dur

echo "🔄 Ring Panel - Update Deployment Başlatılıyor..."
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

# 3. Backend dependencies (eğer package.json değiştiyse)
echo "📦 Backend bağımlılıkları kontrol ediliyor..."
cd sms-panel/backend
npm install
echo "   ✅ Backend dependencies güncellendi"
echo ""

# 4. PM2 restart
echo "🔄 Backend restart ediliyor..."
pm2 restart sms-panel-backend
echo "   ✅ Backend restart edildi"
echo ""

# 5. Nginx reload
echo "🌐 Nginx reload ediliyor..."
nginx -t && systemctl reload nginx
echo "   ✅ Nginx reload edildi"
echo ""

# 6. Durum kontrolü
echo "📊 Sistem Durumu:"
echo "================================================"
pm2 list
echo ""
pm2 logs sms-panel-backend --lines 20 --nostream
echo ""

echo "✅ Update deployment tamamlandı!"
echo ""
echo "📋 Logları görüntülemek için:"
echo "   pm2 logs sms-panel-backend"
echo ""
