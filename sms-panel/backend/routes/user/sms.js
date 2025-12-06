const express = require('express');
const router = express.Router();
const SMS = require('../../models/SMS');
const Permission = require('../../models/Permission');
const Device = require('../../models/Device');
const { verifyToken, checkDevicePermission } = require('../../middleware/auth');
const { logSMSAction } = require('../../services/activityLogger');

// Tüm route'lar için auth middleware
router.use(verifyToken);

/**
 * GET /api/user/sms/:deviceId
 * Belirli cihazın SMS'lerini getir
 */
router.get('/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 50, skip = 0, phoneNumber, type, search } = req.query;

    // Yetki kontrolü
    const hasPermission = await Permission.hasPermission(req.user._id, deviceId);

    if (!hasPermission && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bu cihaza erişim yetkiniz yok'
      });
    }

    // Filtre oluştur
    const filter = { deviceId };

    if (phoneNumber) filter.phoneNumber = phoneNumber;
    if (type) filter.type = type;
    if (search) {
      filter.$or = [
        { message: { $regex: search, $options: 'i' } },
        { contactName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const [messages, total] = await Promise.all([
      SMS.find(filter)
        .sort({ timestamp: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit)),
      SMS.countDocuments(filter)
    ]);

    res.json({
      success: true,
      messages,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error('SMS list hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/user/sms/:deviceId/contacts
 * Cihazın konuşmalarını (kişilere göre gruplu) getir
 */
router.get('/:deviceId/contacts', async (req, res) => {
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

    // Konuşmaları getir
    const conversations = await SMS.getConversations(deviceId);

    res.json({
      success: true,
      conversations
    });
  } catch (error) {
    console.error('Contacts list hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/user/sms/:deviceId/conversation/:phoneNumber
 * Belirli bir kişiyle olan konuşmayı getir
 */
router.get('/:deviceId/conversation/:phoneNumber', async (req, res) => {
  try {
    const { deviceId, phoneNumber } = req.params;
    const { limit = 100, skip = 0 } = req.query;

    // Yetki kontrolü
    const hasPermission = await Permission.hasPermission(req.user._id, deviceId);

    if (!hasPermission && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bu cihaza erişim yetkiniz yok'
      });
    }

    // Decode phone number (URL encoded olabilir)
    const decodedPhoneNumber = decodeURIComponent(phoneNumber);

    const [messages, total] = await Promise.all([
      SMS.find({ deviceId, phoneNumber: decodedPhoneNumber })
        .sort({ timestamp: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit)),
      SMS.countDocuments({ deviceId, phoneNumber: decodedPhoneNumber })
    ]);

    // Kişi adını al (varsa)
    const contactName = messages[0]?.contactName || '';

    res.json({
      success: true,
      phoneNumber: decodedPhoneNumber,
      contactName,
      messages,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error('Conversation hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * PUT /api/user/sms/:smsId/read
 * SMS'i okundu olarak işaretle
 */
router.put('/:smsId/read', async (req, res) => {
  try {
    const { smsId } = req.params;

    const sms = await SMS.findById(smsId);

    if (!sms) {
      return res.status(404).json({
        success: false,
        message: 'SMS bulunamadı'
      });
    }

    // Yetki kontrolü
    const hasPermission = await Permission.hasPermission(req.user._id, sms.deviceId);

    if (!hasPermission && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bu SMS\'e erişim yetkiniz yok'
      });
    }

    // Zaten okunmuşsa
    if (sms.read) {
      return res.json({
        success: true,
        message: 'SMS zaten okundu olarak işaretli'
      });
    }

    sms.read = true;
    await sms.save();

    // Log
    const device = await Device.findById(sms.deviceId);
    await logSMSAction(req.user, 'SMS_READ', sms, device, req);

    res.json({
      success: true,
      message: 'SMS okundu olarak işaretlendi'
    });
  } catch (error) {
    console.error('SMS read hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * PUT /api/user/sms/:deviceId/conversation/:phoneNumber/read-all
 * Bir konuşmadaki tüm SMS'leri okundu olarak işaretle
 */
router.put('/:deviceId/conversation/:phoneNumber/read-all', async (req, res) => {
  try {
    const { deviceId, phoneNumber } = req.params;

    // Yetki kontrolü
    const hasPermission = await Permission.hasPermission(req.user._id, deviceId);

    if (!hasPermission && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bu cihaza erişim yetkiniz yok'
      });
    }

    const decodedPhoneNumber = decodeURIComponent(phoneNumber);

    const result = await SMS.updateMany(
      { deviceId, phoneNumber: decodedPhoneNumber, read: false },
      { $set: { read: true } }
    );

    res.json({
      success: true,
      message: `${result.modifiedCount} SMS okundu olarak işaretlendi`
    });
  } catch (error) {
    console.error('Read all hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/user/sms/unread/count
 * Tüm yetkili cihazlardaki okunmamış SMS sayısı
 */
router.get('/unread/count', async (req, res) => {
  try {
    // Kullanıcının yetkili olduğu cihazları al
    const permissions = await Permission.find({
      userId: req.user._id,
      isActive: true
    }).select('deviceId');

    const deviceIds = permissions.map(p => p.deviceId);

    // Toplam okunmamış sayısı
    const unreadCount = await SMS.countDocuments({
      deviceId: { $in: deviceIds },
      read: false
    });

    // Cihaz bazlı okunmamış sayıları
    const deviceUnreadCounts = await SMS.aggregate([
      {
        $match: {
          deviceId: { $in: deviceIds },
          read: false
        }
      },
      {
        $group: {
          _id: '$deviceId',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({
      success: true,
      totalUnread: unreadCount,
      byDevice: deviceUnreadCounts.reduce((acc, item) => {
        acc[item._id.toString()] = item.count;
        return acc;
      }, {})
    });
  } catch (error) {
    console.error('Unread count hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

module.exports = router;
