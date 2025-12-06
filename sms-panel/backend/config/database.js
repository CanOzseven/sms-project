const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

/**
 * MongoDB bağlantısını başlat ve ilk admin kullanıcısını oluştur
 */
async function connectDB() {
  try {
    // MongoDB bağlantı seçenekleri
    const options = {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    };

    // Bağlantıyı kur
    await mongoose.connect(process.env.MONGODB_URI, options);
    console.log('✅ MongoDB bağlantısı başarılı');

    // Bağlantı olaylarını dinle
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB bağlantı hatası:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB bağlantısı kesildi');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB yeniden bağlandı');
    });

    // İlk admin kullanıcısını oluştur
    await createInitialAdmin();

    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB bağlantı hatası:', error.message);
    process.exit(1);
  }
}

/**
 * İlk admin kullanıcısını oluştur (yoksa)
 */
async function createInitialAdmin() {
  try {
    const adminEmail = 'admin@sms-panel.com';
    const adminPassword = 'admin123';

    // Admin var mı kontrol et
    const adminExists = await User.findOne({ email: adminEmail });

    if (!adminExists) {
      // Şifreyi hashle
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      // Admin oluştur
      await User.create({
        name: 'Admin',
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        status: 'active'
      });

      console.log('✅ İlk admin oluşturuldu');
      console.log('   📧 Email: admin@sms-panel.com');
      console.log('   🔑 Password: admin123');
      console.log('   ⚠️  Lütfen production\'da şifreyi değiştirin!');
    }
  } catch (error) {
    console.error('❌ Admin oluşturma hatası:', error.message);
  }
}

/**
 * Bağlantıyı kapat
 */
async function disconnectDB() {
  try {
    await mongoose.connection.close();
    console.log('✅ MongoDB bağlantısı kapatıldı');
  } catch (error) {
    console.error('❌ MongoDB bağlantı kapatma hatası:', error.message);
  }
}

module.exports = connectDB;
module.exports.disconnectDB = disconnectDB;
