const mongoose = require('mongoose');

// Aktivite Log şeması - Sistem aktivitelerini kaydetmek için
const activityLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  action: {
    type: String,
    required: [true, 'Aksiyon alanı zorunludur'],
    trim: true,
    enum: {
      values: [
        // Auth işlemleri
        'LOGIN',
        'LOGOUT',
        'LOGIN_FAILED',
        // Kullanıcı işlemleri
        'USER_CREATE',
        'USER_UPDATE',
        'USER_DELETE',
        'PASSWORD_CHANGE',
        // Cihaz işlemleri
        'DEVICE_CREATE',
        'DEVICE_UPDATE',
        'DEVICE_DELETE',
        'DEVICE_ACTIVATE',
        'DEVICE_ONLINE',
        'DEVICE_OFFLINE',
        // Yetki işlemleri
        'PERMISSION_GRANT',
        'PERMISSION_REVOKE',
        // SMS işlemleri
        'SMS_SYNC',
        'SMS_READ',
        'SMS_DELETE',
        // Sistem işlemleri
        'SYSTEM_ERROR',
        'API_ACCESS'
      ],
      message: 'Geçersiz aksiyon tipi'
    }
  },
  details: {
    type: String,
    trim: true,
    default: ''
  },
  // İlişkili kayıtlar
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    default: null
  },
  smsId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SMS',
    default: null
  },
  targetUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // İstek bilgileri
  ipAddress: {
    type: String,
    trim: true,
    default: ''
  },
  userAgent: {
    type: String,
    trim: true,
    default: ''
  },
  // Ekstra metadata (JSON olarak saklanabilir)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

// Index tanımları - Log sorguları için optimize
activityLogSchema.index({ timestamp: -1 });
activityLogSchema.index({ userId: 1, timestamp: -1 });
activityLogSchema.index({ action: 1, timestamp: -1 });
activityLogSchema.index({ deviceId: 1, timestamp: -1 });

// TTL Index - 90 gün sonra otomatik sil (opsiyonel - production'da aktif edilebilir)
// activityLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 });

// Statik method: Aktivite logla
activityLogSchema.statics.log = async function(data) {
  try {
    return await this.create(data);
  } catch (error) {
    console.error('Activity log error:', error);
    // Log hatası ana işlemi durdurmamalı
    return null;
  }
};

// Statik method: Kullanıcı aktivitelerini getir
activityLogSchema.statics.getUserActivity = async function(userId, limit = 50) {
  return this.find({ userId })
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('deviceId', 'name')
    .lean();
};

// Statik method: Son aktiviteleri getir
activityLogSchema.statics.getRecentActivity = async function(limit = 100) {
  return this.find()
    .sort({ timestamp: -1 })
    .limit(limit)
    .populate('userId', 'name email')
    .populate('deviceId', 'name')
    .lean();
};

module.exports = mongoose.model('ActivityLog', activityLogSchema);
