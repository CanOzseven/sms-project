const express = require('express');
const cors = require('cors');
require('dotenv').config();

const connectDB = require('./config/database');
const { markOfflineDevices } = require('./routes/device/heartbeat');
const { cleanupOldMessages, getCleanupStats } = require('./services/smsCleanup');

const app = express();

// ==================== MIDDLEWARE ====================

// CORS ayarları
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'activation-code', 'x-activation-code']
}));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging (development)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// ==================== DATABASE ====================

connectDB();

// ==================== ROUTES ====================

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Ring Panel API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Ana Sayfa
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Ring Panel API',
    version: '1.0.0',
    endpoints: {
      admin: '/api/admin',
      user: '/api/user',
      device: '/api/device'
    }
  });
});

// Unified Auth Route (role-based login)
app.use('/api/auth', require('./routes/auth'));

// Admin Routes
app.use('/api/admin', require('./routes/admin/auth'));
app.use('/api/admin/users', require('./routes/admin/users'));
app.use('/api/admin/devices', require('./routes/admin/devices'));
app.use('/api/admin/permissions', require('./routes/admin/permissions'));
app.use('/api/admin/sms', require('./routes/admin/sms'));

// User Routes
app.use('/api/user', require('./routes/user/auth'));
app.use('/api/user/devices', require('./routes/user/devices'));
app.use('/api/user/sms', require('./routes/user/sms'));
app.use('/api/user/profile', require('./routes/user/profile'));

// Device Routes (Android app için)
app.use('/api/device', require('./routes/device/activation'));
app.use('/api/device', require('./routes/device/sync'));
app.use('/api/device', require('./routes/device/heartbeat'));

// ==================== ERROR HANDLING ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint bulunamadı',
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err);

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    return res.status(400).json({
      success: false,
      message: 'Validation hatası',
      errors: messages
    });
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Bu kayıt zaten mevcut'
    });
  }

  // JWT error
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Geçersiz token'
    });
  }

  // Default error
  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production'
      ? 'Sunucu hatası'
      : err.message
  });
});

// ==================== SERVER ====================

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║       RING PANEL BACKEND SERVER            ║');
  console.log('╠════════════════════════════════════════════╣');
  console.log(`║  🚀 Server running on port ${PORT}            ║`);
  console.log(`║  📁 Environment: ${(process.env.NODE_ENV || 'development').padEnd(18)}║`);
  console.log('╠════════════════════════════════════════════╣');
  console.log('║  Endpoints:                                ║');
  console.log('║  • Admin Panel: /api/admin                 ║');
  console.log('║  • User Panel:  /api/user                  ║');
  console.log('║  • Device API:  /api/device                ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
});

// ==================== SCHEDULED TASKS ====================

// Her 2 dakikada bir offline cihazları işaretle
setInterval(async () => {
  try {
    await markOfflineDevices();
  } catch (error) {
    console.error('Offline devices check error:', error);
  }
}, 2 * 60 * 1000);

// Günlük SMS temizliği - Her gün saat 23:59'da çalış
function scheduleDailyCleanup() {
  const now = new Date();
  const night = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23, 59, 0, 0 // 23:59:00
  );

  // Eğer bugünün 23:59'u geçtiyse, yarının 23:59'unu ayarla
  if (now > night) {
    night.setDate(night.getDate() + 1);
  }

  const msUntilMidnight = night.getTime() - now.getTime();

  console.log(`📅 Günlük SMS temizliği planlandı: ${night.toLocaleString('tr-TR')}`);

  setTimeout(async () => {
    // İlk cleanup'ı çalıştır
    await cleanupOldMessages(1); // 1 günden eski mesajları sil

    // Her gün aynı saatte tekrarla (24 saat = 86400000 ms)
    setInterval(async () => {
      await cleanupOldMessages(1);
    }, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);
}

// Cleanup'ı başlat
scheduleDailyCleanup();

// Startup'ta istatistikleri göster
(async () => {
  const stats = await getCleanupStats();
  if (stats) {
    console.log('📊 SMS İstatistikleri:');
    console.log(`   Toplam: ${stats.total}`);
    console.log(`   Bugün: ${stats.today}`);
    console.log(`   Dün: ${stats.yesterday}`);
    console.log(`   Daha eski: ${stats.older}`);
  }
})();

// ==================== GRACEFUL SHUTDOWN ====================

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM sinyali alındı, sunucu kapatılıyor...');
  server.close(() => {
    console.log('✅ Sunucu kapatıldı');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT sinyali alındı, sunucu kapatılıyor...');
  server.close(() => {
    console.log('✅ Sunucu kapatıldı');
    process.exit(0);
  });
});

module.exports = app;
