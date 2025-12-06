const express = require('express');
const router = express.Router();
const SMS = require('../../models/SMS');
const Device = require('../../models/Device');
const { verifyToken, isAdmin } = require('../../middleware/auth');

// Tüm route'lar için auth middleware
router.use(verifyToken, isAdmin);

/**
 * GET /api/admin/sms/all
 * Tüm SMS'leri listele
 */
router.get('/all', async (req, res) => {
  try {
    const {
      deviceId,
      phoneNumber,
      type,
      read,
      startDate,
      endDate,
      search,
      limit = 50,
      skip = 0
    } = req.query;

    // Filtre oluştur
    const filter = {};

    if (deviceId) filter.deviceId = deviceId;
    if (phoneNumber) filter.phoneNumber = { $regex: phoneNumber, $options: 'i' };
    if (type) filter.type = type;
    if (read !== undefined) filter.read = read === 'true';

    // Tarih filtresi
    if (startDate || endDate) {
      filter.timestamp = {};
      if (startDate) filter.timestamp.$gte = new Date(startDate);
      if (endDate) filter.timestamp.$lte = new Date(endDate);
    }

    // Mesaj içeriği araması
    if (search) {
      filter.$or = [
        { message: { $regex: search, $options: 'i' } },
        { contactName: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const [messages, total] = await Promise.all([
      SMS.find(filter)
        .populate('deviceId', 'name')
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
    console.error('SMS all hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/admin/sms/device/:deviceId
 * Belirli cihazın SMS'lerini getir
 */
router.get('/device/:deviceId', async (req, res) => {
  try {
    const { limit = 50, skip = 0 } = req.query;

    // Cihaz var mı kontrol et
    const device = await Device.findById(req.params.deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Cihaz bulunamadı'
      });
    }

    const [messages, total] = await Promise.all([
      SMS.find({ deviceId: req.params.deviceId })
        .sort({ timestamp: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit)),
      SMS.countDocuments({ deviceId: req.params.deviceId })
    ]);

    res.json({
      success: true,
      device: {
        id: device._id,
        name: device.name
      },
      messages,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error('SMS device hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/admin/sms/stats
 * SMS istatistikleri
 */
router.get('/stats', async (req, res) => {
  try {
    const { deviceId, days = 7 } = req.query;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const matchFilter = { timestamp: { $gte: startDate } };
    if (deviceId) matchFilter.deviceId = deviceId;

    // Gün bazlı istatistikler
    const dailyStats = await SMS.aggregate([
      { $match: matchFilter },
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

    // Cihaz bazlı istatistikler
    const deviceStats = await SMS.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: '$deviceId',
          total: { $sum: 1 },
          received: {
            $sum: { $cond: [{ $eq: ['$type', 'received'] }, 1, 0] }
          },
          sent: {
            $sum: { $cond: [{ $eq: ['$type', 'sent'] }, 1, 0] }
          }
        }
      },
      {
        $lookup: {
          from: 'devices',
          localField: '_id',
          foreignField: '_id',
          as: 'device'
        }
      },
      { $unwind: '$device' },
      {
        $project: {
          deviceName: '$device.name',
          total: 1,
          received: 1,
          sent: 1
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Genel istatistikler
    const [totalReceived, totalSent, unreadCount] = await Promise.all([
      SMS.countDocuments({ ...matchFilter, type: 'received' }),
      SMS.countDocuments({ ...matchFilter, type: 'sent' }),
      SMS.countDocuments({ read: false })
    ]);

    res.json({
      success: true,
      stats: {
        period: `${days} gün`,
        total: totalReceived + totalSent,
        received: totalReceived,
        sent: totalSent,
        unread: unreadCount,
        dailyStats,
        deviceStats
      }
    });
  } catch (error) {
    console.error('SMS stats hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * DELETE /api/admin/sms/:id
 * SMS sil
 */
router.delete('/:id', async (req, res) => {
  try {
    const sms = await SMS.findById(req.params.id);

    if (!sms) {
      return res.status(404).json({
        success: false,
        message: 'SMS bulunamadı'
      });
    }

    // Cihazın SMS sayısını güncelle
    await Device.findByIdAndUpdate(sms.deviceId, {
      $inc: { totalSMS: -1 }
    });

    await SMS.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'SMS silindi'
    });
  } catch (error) {
    console.error('SMS delete hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * DELETE /api/admin/sms/device/:deviceId/all
 * Cihazın tüm SMS'lerini sil
 */
router.delete('/device/:deviceId/all', async (req, res) => {
  try {
    const device = await Device.findById(req.params.deviceId);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Cihaz bulunamadı'
      });
    }

    const result = await SMS.deleteMany({ deviceId: req.params.deviceId });

    // Cihazın SMS sayısını sıfırla
    device.totalSMS = 0;
    await device.save();

    res.json({
      success: true,
      message: `${result.deletedCount} SMS silindi`
    });
  } catch (error) {
    console.error('SMS delete all hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

module.exports = router;
