const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
require('dotenv').config();

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

    // Test user oluştur
    await createTestUser();

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
    const adminUsername = 'admin';
    const adminPassword = 'admin123';
    const adminEmail = 'admin@example.com'; // Email ekledik
    const activationCode = Math.random().toString(36).substring(2, 12); // Rastgele 10 karakter

    // Admin var mı kontrol et
    const adminExists = await User.findOne({ username: adminUsername });

    if (!adminExists) {
      // Şifreyi hashle
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(adminPassword, salt);

      // Admin oluştur
      await User.create({
        username: adminUsername,
        email: adminEmail,
        password: hashedPassword,
        role: 'admin',
        status: 'active',
        activationCode: activationCode
      });

      console.log('✅ İlk admin oluşturuldu');
      console.log('   👤 Username:', adminUsername);
      console.log('   🔑 Password:', adminPassword);
      console.log('   ⚠️  Lütfen production\'da şifreyi değiştirin!');
    }
  } catch (error) {
    console.error('❌ Admin oluşturma hatası:', error.message);
  }
}


/**
 * Test user oluştur (yoksa)
 */
async function createTestUser() {
  try {
    const testUsername = 'testuser';
    const testPassword = 'test123';

    // Test user var mı kontrol et
    const userExists = await User.findOne({ username: testUsername });

    if (!userExists) {
      // Şifreyi hashle
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(testPassword, salt);

      // Test user oluştur
      await User.create({
        username: testUsername,
        password: hashedPassword,
        role: 'user',
        status: 'active'
      });

      console.log('✅ Test user oluşturuldu');
      console.log('   👤 Username: testuser');
      console.log('   🔑 Password: test123');
      console.log('   📱 Role: user');
    }
  } catch (error) {
    console.error('❌ Test user oluşturma hatası:', error.message);
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
