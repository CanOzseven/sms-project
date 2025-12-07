#!/bin/bash

# SMS Panel - Android APK Build Script
# Müşteriye dağıtılabilir APK oluşturur

set -e

echo "╔════════════════════════════════════════════╗"
echo "║     SMS PANEL - ANDROID APK BUILD         ║"
echo "╚════════════════════════════════════════════╝"
echo ""

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log_success() { echo -e "${GREEN}✓ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }
log_error() { echo -e "${RED}✗ $1${NC}"; }
log_info() { echo -e "→ $1"; }

# Android dizinine git
cd "$(dirname "$0")/android"

# Java/JDK kontrolü
if ! command -v java &> /dev/null; then
    log_error "Java JDK bulunamadı! Java 17 kurmanız gerekiyor."
    echo "Kurulum: sudo apt install openjdk-17-jdk"
    exit 1
fi

log_success "Java bulundu: $(java -version 2>&1 | head -1)"

# Gradle wrapper kontrolü
if [ ! -f "gradlew" ]; then
    log_error "gradlew bulunamadı! Android proje dizininde olduğunuzdan emin olun."
    exit 1
fi

# Gradle wrapper'ı çalıştırılabilir yap
chmod +x gradlew
log_success "Gradle wrapper hazır"

echo ""
log_info "APK build başlıyor..."
echo ""

# Clean build
log_info "Önceki build dosyaları temizleniyor..."
./gradlew clean

# Release APK build
log_info "Release APK build ediliyor (bu birkaç dakika sürebilir)..."
./gradlew assembleRelease

# APK konumu
APK_PATH="app/build/outputs/apk/release/app-release.apk"

if [ -f "$APK_PATH" ]; then
    echo ""
    echo "╔════════════════════════════════════════════╗"
    echo "║          APK BUILD BAŞARILI! ✓             ║"
    echo "╚════════════════════════════════════════════╝"
    echo ""
    echo "APK Konumu:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$APK_PATH"
    echo ""

    # APK bilgileri
    APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
    echo "APK Boyutu: $APK_SIZE"
    echo ""

    # APK'yı kullanıcı için kolay erişilebilir bir yere kopyala
    OUTPUT_DIR="../release"
    mkdir -p "$OUTPUT_DIR"

    VERSION=$(grep 'versionName' app/build.gradle.kts | cut -d'"' -f2)
    OUTPUT_APK="$OUTPUT_DIR/SMSPanel-v${VERSION}.apk"

    cp "$APK_PATH" "$OUTPUT_APK"
    log_success "APK kopyalandı: $OUTPUT_APK"

    echo ""
    echo "Sonraki Adımlar:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "1. APK'yı müşteriye gönderin:"
    echo "   → $OUTPUT_APK"
    echo ""
    echo "2. Müşteriye talimatları verin:"
    echo "   → Bilinmeyen kaynaklardan kurulumu aktif et"
    echo "   → APK'yı aç ve yükle"
    echo "   → İzinleri ver (SMS, Kişiler, Bildirimler)"
    echo "   → Server URL: http://VPS_IP_ADRESI"
    echo "   → Aktivasyon kodunu gir (admin panelden)"
    echo ""
    echo "3. Admin panelden cihaz oluştur:"
    echo "   → http://158.220.101.218/admin-panel.html"
    echo "   → Cihazlar → + Yeni Cihaz"
    echo "   → Aktivasyon kodunu müşteriye ver"
    echo ""
else
    log_error "APK build başarısız!"
    echo ""
    echo "Hata ayıklama:"
    echo "→ ./gradlew assembleRelease --info"
    exit 1
fi
