const express = require('express');
const router = express.Router();
const Device = require('../../models/Device');
const Permission = require('../../models/Permission');
const SMS = require('../../models/SMS');
const { verifyToken } = require('../../middleware/auth');

// Tüm route'lar için auth middleware
router.use(verifyToken);

/**
 * GET /api/user/devices
 * Kullanıcının yetkili olduğu cihazları getir
 */
router.get('/', async (req, res) => {
  try {
    // Kullanıcının yetkili olduğu cihazları getir
    const permissions = await Permission.find({
      userId: req.user._id,
      isActive: true
    }).populate({
      path: 'deviceId',
      select: 'name model status lastSeen totalSMS activationCode'
    });

    // Cihazları ve okunmamış mesaj sayılarını hazırla
    const devicesWithUnread = await Promise.all(
      permissions.map(async (permission) => {
        if (!permission.deviceId) return null;

        const device = permission.deviceId;
        const unreadCount = await SMS.countDocuments({
          deviceId: device._id,
          read: false
        });

        return {
          id: device._id,
          name: device.name,
          model: device.model,
          status: device.status,
          lastSeen: device.lastSeen,
          totalSMS: device.totalSMS,
          unreadCount,
          grantedAt: permission.grantedAt
        };
      })
    );

    // null değerleri filtrele
    const devices = devicesWithUnread.filter(d => d !== null);

    res.json({
      success: true,
      devices
    });
  } catch (error) {
    console.error('User devices hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/user/devices/:deviceId
 * Belirli bir cihazın detaylarını getir
 */
router.get('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Yetki kontrolü
    const hasPermission = await Permission.hasPermission(req.user._id, deviceId);

    if (!hasPermission && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bu cihaza erişim yetkiniz yok'
      });
    }

    const device = await Device.findById(deviceId)
      .select('name model status lastSeen totalSMS');

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Cihaz bulunamadı'
      });
    }

    // Okunmamış mesaj sayısı
    const unreadCount = await SMS.countDocuments({
      deviceId: device._id,
      read: false
    });

    // Son aktivite
    const lastMessage = await SMS.findOne({ deviceId: device._id })
      .sort({ timestamp: -1 })
      .select('timestamp type');

    res.json({
      success: true,
      device: {
        id: device._id,
        name: device.name,
        model: device.model,
        status: device.status,
        lastSeen: device.lastSeen,
        totalSMS: device.totalSMS,
        unreadCount,
        lastMessageAt: lastMessage?.timestamp || null
      }
    });
  } catch (error) {
    console.error('Device detail hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/user/devices/:deviceId/stats
 * Cihazın SMS istatistikleri
 */
router.get('/:deviceId/stats', async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Yetki kontrolü
    const hasPermission = await Permission.hasPermission(req.user._id, deviceId);

    if (!hasPermission && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bu cihaza erişim yetkiniz yok'
      });
    }

    // Son 7 günlük istatistikler
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);

    const stats = await SMS.aggregate([
      {
        $match: {
          deviceId: require('mongoose').Types.ObjectId.createFromHexString(deviceId),
          timestamp: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            type: '$type'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1 } }
    ]);

    // Genel sayılar
    const [totalReceived, totalSent, unreadCount] = await Promise.all([
      SMS.countDocuments({ deviceId, type: 'received' }),
      SMS.countDocuments({ deviceId, type: 'sent' }),
      SMS.countDocuments({ deviceId, read: false })
    ]);

    res.json({
      success: true,
      stats: {
        total: totalReceived + totalSent,
        received: totalReceived,
        sent: totalSent,
        unread: unreadCount,
        daily: stats
      }
    });
  } catch (error) {
    console.error('Device stats hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

module.exports = router;
