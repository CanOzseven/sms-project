#!/bin/bash

# SMS Panel - Frontend Development Server
# HTML dosyalarını localhost'ta serve eder

echo "╔════════════════════════════════════════════╗"
echo "║   FRONTEND DEVELOPMENT SERVER              ║"
echo "╚════════════════════════════════════════════╝"
echo ""

cd "$(dirname "$0")/frontend"

# API_URL'i development için değiştir
echo "→ Development modu için API_URL ayarlanıyor..."
sed -i.bak "s|const API_URL = '/api'|const API_URL = 'http://localhost:3000/api'|g" *.html
echo "✓ API_URL: http://localhost:3000/api"
echo ""

echo "Frontend Server Başlatılıyor..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Admin Panel:  http://localhost:8080/admin-panel.html"
echo "User Panel:   http://localhost:8080/user-panel.html"
echo ""
echo "Çıkmak için: Ctrl+C"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Cleanup on exit
trap "echo '' && echo '→ API_URL production moduna dönüyor...' && sed -i.bak \"s|const API_URL = 'http://localhost:3000/api'|const API_URL = '/api'|g\" *.html && rm -f *.html.bak && echo '✓ Temizlendi!' && exit" INT TERM

# Python web server başlat
python3 -m http.server 8080
