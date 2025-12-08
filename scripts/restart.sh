#!/bin/bash
###############################################################################
# Quick Restart Script
# Backend'i hızlıca restart eder (güncelleme çekmez)
###############################################################################

echo "🔄 Ring Panel - Backend Restart..."
echo "=================================="
echo ""

cd /root/sms-project/sms-panel/backend

echo "🔄 PM2 restart ediliyor..."
pm2 restart sms-panel-backend
echo "   ✅ Backend restart edildi"
echo ""

echo "📊 Sistem Durumu:"
pm2 list
echo ""

echo "📋 Son loglar:"
pm2 logs sms-panel-backend --lines 15 --nostream
echo ""

echo "✅ Restart tamamlandı!"
echo ""
