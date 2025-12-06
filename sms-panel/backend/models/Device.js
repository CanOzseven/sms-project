const mongoose = require('mongoose');
const crypto = require('crypto');

// Cihaz şeması - Android cihazları için
const deviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Cihaz adı zorunludur'],
    trim: true,
    minlength: [2, 'Cihaz adı en az 2 karakter olmalıdır']
  },
  activationCode: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    minlength: 8,
    maxlength: 8
  },
  model: {
    type: String,
    trim: true,
    default: ''
  },
  androidId: {
    type: String,
    trim: true,
    default: ''
  },
  status: {
    type: String,
    enum: {
      values: ['online', 'offline'],
      message: 'Durum online veya offline olmalıdır'
    },
    default: 'offline'
  },
  lastSeen: {
    type: Date,
    default: Date.now
  },
  totalSMS: {
    type: Number,
    default: 0,
    min: 0
  },
  // Cihazın aktif olup olmadığı (aktivasyon yapılmış mı)
  isActivated: {
    type: Boolean,
    default: false
  },
  activatedAt: {
    type: Date,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Kayıt öncesi aktivasyon kodu oluştur
deviceSchema.pre('save', function(next) {
  // Yeni kayıt ve aktivasyon kodu yoksa oluştur
  if (this.isNew && !this.activationCode) {
    this.activationCode = crypto.randomBytes(4).toString('hex').toUpperCase();
  }
  this.updatedAt = new Date();
  next();
});

// Statik method: Aktivasyon kodu oluştur
deviceSchema.statics.generateActivationCode = function() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
};

// Instance method: Cihazı online yap
deviceSchema.methods.setOnline = function() {
  this.status = 'online';
  this.lastSeen = new Date();
  return this.save();
};

// Instance method: Cihazı offline yap
deviceSchema.methods.setOffline = function() {
  this.status = 'offline';
  return this.save();
};

// Index tanımları
deviceSchema.index({ activationCode: 1 });
deviceSchema.index({ status: 1 });
deviceSchema.index({ lastSeen: -1 });

module.exports = mongoose.model('Device', deviceSchema);
