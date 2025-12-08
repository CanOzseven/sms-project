#!/usr/bin/env node
/**
 * Database Reset Script
 * Tüm collection'ları temizler ve sadece admin kullanıcısını oluşturur
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Device = require('../models/Device');
const SMS = require('../models/SMS');

async function resetDatabase() {
  try {
    console.log('🔄 Veritabanı sıfırlama başlatılıyor...\n');

    // MongoDB'ye bağlan
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB bağlantısı başarılı\n');

    // Email index'ini drop et (eğer varsa)
    try {
      await User.collection.dropIndex('email_1');
      console.log('✅ Email index silindi');
    } catch (error) {
      if (error.code === 27) {
        console.log('ℹ️  Email index zaten yok');
      } else {
        console.log('⚠️  Email index silinemedi:', error.message);
      }
    }

    // Tüm collection'ları temizle
    console.log(`\n🗑️  Collection'lar temizleniyor...`);
    
    const usersDeleted = await User.deleteMany({});
    console.log(`   ✅ ${usersDeleted.deletedCount} kullanıcı silindi`);

    const devicesDeleted = await Device.deleteMany({});
    console.log(`   ✅ ${devicesDeleted.deletedCount} cihaz silindi`);

    const smsDeleted = await SMS.deleteMany({});
    console.log(`   ✅ ${smsDeleted.deletedCount} SMS silindi`);

    // Admin kullanıcısını oluştur
    console.log('\n👤 Admin kullanıcısı oluşturuluyor...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    await User.create({
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      status: 'active'
    });

    console.log('✅ Admin kullanıcısı oluşturuldu');
    console.log('   👤 Username: admin');
    console.log('   🔑 Password: admin123');
    console.log('   ⚠️  Lütfen production\'da şifreyi değiştirin!');

    console.log('\n✅ Veritabanı başarıyla sıfırlandı!\n');

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Hata:', error.message);
    process.exit(1);
  }
}

// Script'i çalıştır
resetDatabase();
