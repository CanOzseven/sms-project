const mongoose = require('mongoose');

// Kullanıcı şeması - Admin ve normal kullanıcılar için
const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Kullanıcı adı alanı zorunludur'],
    unique: true,
    lowercase: true,
    trim: true,
    minlength: [3, 'Kullanıcı adı en az 3 karakter olmalıdır'],
    maxlength: [30, 'Kullanıcı adı en fazla 30 karakter olabilir'],
    match: [/^[a-z0-9_-]+$/, 'Kullanıcı adı sadece küçük harf, rakam, tire ve alt çizgi içerebilir']
  },
  password: {
    type: String,
    required: [true, 'Şifre alanı zorunludur'],
    minlength: [6, 'Şifre en az 6 karakter olmalıdır']
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'user'],
      message: 'Rol admin veya user olmalıdır'
    },
    default: 'user'
  },
  // Kullanıcının erişim yetkisi olan cihazlar
  authorizedDevices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device'
  }],
  status: {
    type: String,
    enum: {
      values: ['active', 'inactive'],
      message: 'Durum active veya inactive olmalıdır'
    },
    default: 'active'
  },
  lastLogin: {
    type: Date,
    default: null
  },
  // Aktif session token - single session management için
  currentSessionToken: {
    type: String,
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

// Güncelleme zamanını otomatik ayarla
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Şifreyi JSON'dan çıkar
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  return user;
};

// Index tanımları - performans için
userSchema.index({ role: 1, status: 1 });

module.exports = mongoose.model('User', userSchema);
