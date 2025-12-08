#!/bin/bash

###############################################################################
# SMS Panel - System Reset Script
# Admin user hariç tüm verileri siler ve sistemi temiz duruma getirir
###############################################################################

set -e

# Renkler
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${RED}"
echo "╔═══════════════════════════════════════════╗"
echo "║    ⚠️  SYSTEM RESET - FULL CLEAN  ⚠️     ║"
echo "╚═══════════════════════════════════════════╝"
echo -e "${NC}"

echo -e "${YELLOW}Bu işlem:${NC}"
echo "  ❌ Tüm SMS kayıtlarını silecek"
echo "  ❌ Tüm cihazları silecek"
echo "  ❌ Tüm kullanıcıları (admin hariç) silecek"
echo "  ❌ Tüm yetkileri silecek"
echo "  ❌ Tüm aktivite loglarını silecek"
echo "  ✅ Admin kullanıcısını koruyacak"
echo ""

read -p "$(echo -e ${RED}Devam etmek istediğinizden EMİN misiniz? [evet yazın]: ${NC})" confirmation

if [ "$confirmation" != "evet" ]; then
  echo -e "${GREEN}İşlem iptal edildi.${NC}"
  exit 0
fi

echo ""
echo -e "${RED}SON UYARI: Bu işlem GERİ ALINAMAZ!${NC}"
read -p "$(echo -e ${RED}Onaylıyor musunuz? [EVET yazın]: ${NC})" final_confirmation

if [ "$final_confirmation" != "EVET" ]; then
  echo -e "${GREEN}İşlem iptal edildi.${NC}"
  exit 0
fi

echo ""
echo -e "${YELLOW}Sistem temizleniyor...${NC}"

# MongoDB script çalıştır
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/sms-panel/backend"

cd "$BACKEND_DIR"

# Geçici Node.js script oluştur
cat > /tmp/reset-system.js << 'EOFSCRIPT'
const mongoose = require('mongoose');
require('dotenv').config();

// Models
const User = require('./models/User');
const Device = require('./models/Device');
const SMS = require('./models/SMS');
const Permission = require('./models/Permission');
const ActivityLog = require('./models/ActivityLog');

async function resetSystem() {
  try {
    console.log('MongoDB bağlanıyor...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ Bağlantı başarılı\n');

    // 1. Activity Logs temizle
    console.log('[1/5] Activity Log\'ları siliniyor...');
    const logResult = await ActivityLog.deleteMany({});
    console.log(`✓ ${logResult.deletedCount} aktivite logu silindi\n`);

    // 2. Permissions temizle
    console.log('[2/5] Yetkilendirmeler siliniyor...');
    const permResult = await Permission.deleteMany({});
    console.log(`✓ ${permResult.deletedCount} yetki silindi\n`);

    // 3. SMS'leri temizle
    console.log('[3/5] SMS kayıtları siliniyor...');
    const smsResult = await SMS.deleteMany({});
    console.log(`✓ ${smsResult.deletedCount} SMS kaydı silindi\n`);

    // 4. Cihazları temizle
    console.log('[4/5] Cihazlar siliniyor...');
    const deviceResult = await Device.deleteMany({});
    console.log(`✓ ${deviceResult.deletedCount} cihaz silindi\n`);

    // 5. Kullanıcıları temizle (admin hariç)
    console.log('[5/5] Kullanıcılar siliniyor (admin hariç)...');
    const userResult = await User.deleteMany({ role: { $ne: 'admin' } });
    console.log(`✓ ${userResult.deletedCount} kullanıcı silindi\n`);

    // Admin kullanıcısını temizle ve yenile
    console.log('[BONUS] Admin kullanıcısı yenileniyor...');
    const bcrypt = require('bcryptjs');
    const adminEmail = 'admin@sms-panel.com';
    const adminPassword = await bcrypt.hash('admin123', 10);

    await User.findOneAndUpdate(
      { email: adminEmail },
      {
        name: 'Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        authorizedDevices: [],
        status: 'active'
      },
      { upsert: true, new: true }
    );
    console.log('✓ Admin kullanıcısı hazır (admin@sms-panel.com / admin123)\n');

    console.log('═══════════════════════════════════════════');
    console.log('✅ SİSTEM BAŞARIYLA TEMİZLENDİ!');
    console.log('═══════════════════════════════════════════');
    console.log('\n📊 Özet:');
    console.log(`  • ${logResult.deletedCount} aktivite logu silindi`);
    console.log(`  • ${permResult.deletedCount} yetki silindi`);
    console.log(`  • ${smsResult.deletedCount} SMS silindi`);
    console.log(`  • ${deviceResult.deletedCount} cihaz silindi`);
    console.log(`  • ${userResult.deletedCount} kullanıcı silindi`);
    console.log('\n🔐 Admin Bilgileri:');
    console.log('  Email: admin@sms-panel.com');
    console.log('  Password: admin123');
    console.log('\n⚠️  Production\'da admin şifresini değiştirmeyi unutmayın!\n');

    process.exit(0);
  } catch (error) {
    console.error('HATA:', error);
    process.exit(1);
  }
}

resetSystem();
EOFSCRIPT

# Script'i çalıştır
node /tmp/reset-system.js

# Temizlik
rm /tmp/reset-system.js

echo ""
echo -e "${GREEN}Sistem kullanıma hazır! 🚀${NC}"
