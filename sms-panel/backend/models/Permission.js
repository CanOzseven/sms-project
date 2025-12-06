const mongoose = require('mongoose');

// Yetki şeması - Kullanıcı-Cihaz erişim yetkisi
const permissionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Kullanıcı ID zorunludur']
  },
  deviceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Device',
    required: [true, 'Cihaz ID zorunludur']
  },
  grantedAt: {
    type: Date,
    default: Date.now
  },
  grantedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  // Yetki notları (opsiyonel)
  notes: {
    type: String,
    trim: true,
    default: ''
  },
  // Yetki aktif mi
  isActive: {
    type: Boolean,
    default: true
  }
});

// Unique compound index - Aynı kullanıcı-cihaz çifti olamaz
permissionSchema.index({ userId: 1, deviceId: 1 }, { unique: true });

// Index tanımları
permissionSchema.index({ userId: 1 });
permissionSchema.index({ deviceId: 1 });
permissionSchema.index({ grantedAt: -1 });

// Statik method: Kullanıcının yetkili olduğu cihazları getir
permissionSchema.statics.getUserDevices = async function(userId) {
  const permissions = await this.find({ userId, isActive: true })
    .populate('deviceId')
    .select('deviceId');
  return permissions.map(p => p.deviceId).filter(d => d !== null);
};

// Statik method: Cihaza yetkili kullanıcıları getir
permissionSchema.statics.getDeviceUsers = async function(deviceId) {
  const permissions = await this.find({ deviceId, isActive: true })
    .populate('userId')
    .select('userId');
  return permissions.map(p => p.userId).filter(u => u !== null);
};

// Statik method: Yetki kontrolü
permissionSchema.statics.hasPermission = async function(userId, deviceId) {
  const permission = await this.findOne({
    userId,
    deviceId,
    isActive: true
  });
  return !!permission;
};

module.exports = mongoose.model('Permission', permissionSchema);
