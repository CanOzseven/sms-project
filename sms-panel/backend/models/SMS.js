const mongoose = require('mongoose');

// SMS şeması - Gelen ve giden mesajlar için
const smsSchema = new mongoose.Schema({
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: [true, 'Cihaz ID zorunludur'],
    index: true
  },
  phoneNumber: {
    type: String,
    required: [true, 'Telefon numarası zorunludur'],
    trim: true,
    index: true
  },
  contactName: {
    type: String,
    trim: true,
    default: ''
  },
  message: {
    type: String,
    required: [true, 'Mesaj içeriği zorunludur']
  },
  type: {
    type: String,
    enum: {
      values: ['received', 'sent'],
      message: 'Tip received veya sent olmalıdır'
    },
    required: [true, 'Mesaj tipi zorunludur']
  },
  // Mesajın cihazda oluşturulma zamanı
  timestamp: {
    type: Date,
    required: [true, 'Mesaj zamanı zorunludur']
  },
  // Mesajın sunucuya ulaşma zamanı
  receivedAt: {
    type: Date,
    default: Date.now
  },
  // Kullanıcı tarafından okundu mu
  read: {
    type: Boolean,
    default: false
  },
  // Android SMS Database ID (benzersiz tanımlayıcı)
  smsId: {
    type: Number,
    sparse: true // Eski kayıtlar için
  },
  // Mesajın benzersiz ID'si (duplicate önleme için - backward compatibility)
  messageHash: {
    type: String,
    index: true
  }
});

// Unique index: Aynı cihazdan aynı SMS ID gelmemeli
smsSchema.index({ deviceId: 1, smsId: 1 }, { unique: true, sparse: true });

// Kayıt öncesi hash oluştur (duplicate önleme)
smsSchema.pre('save', function(next) {
  if (this.isNew && !this.messageHash) {
    // deviceId + phoneNumber + timestamp + message ilk 50 karakteri ile hash
    const hashData = `${this.deviceId}${this.phoneNumber}${this.timestamp}${this.message.substring(0, 50)}`;
    this.messageHash = Buffer.from(hashData).toString('base64').substring(0, 32);
  }
  next();
});

// Compound index - performans için
smsSchema.index({ deviceId: 1, timestamp: -1 });
smsSchema.index({ deviceId: 1, phoneNumber: 1, timestamp: -1 });
smsSchema.index({ deviceId: 1, read: 1 });

// Statik method: Cihaza ait konuşmaları grupla
smsSchema.statics.getConversations = async function(deviceId) {
  return this.aggregate([
    { $match: { deviceId: new mongoose.Types.ObjectId(deviceId) } },
    { $sort: { timestamp: -1 } },
    {
      $group: {
        _id: '$phoneNumber',
        contactName: { $first: '$contactName' },
        lastMessage: { $first: '$message' },
        lastTimestamp: { $first: '$timestamp' },
        type: { $first: '$type' },
        unreadCount: {
          $sum: { $cond: [{ $eq: ['$read', false] }, 1, 0] }
        },
        totalCount: { $sum: 1 }
      }
    },
    { $sort: { lastTimestamp: -1 } }
  ]);
};

// Statik method: Okunmamış SMS sayısı
smsSchema.statics.getUnreadCount = async function(deviceId) {
  return this.countDocuments({ deviceId, read: false });
};

module.exports = mongoose.model('SMS', smsSchema);
