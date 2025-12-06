const express = require('express');
const router = express.Router();
const Device = require('../../models/Device');
const SMS = require('../../models/SMS');
const Permission = require('../../models/Permission');
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { logDeviceAction } = require('../../services/activityLogger');

// Tüm route'lar için auth middleware
router.use(verifyToken, isAdmin);

/**
 * GET /api/admin/devices
 * Tüm cihazları listele
 */
router.get('/', async (req, res) => {
  try {
    const { status, search, limit = 50, skip = 0 } = req.query;

    // Filtre oluştur
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
        { activationCode: { $regex: search, $options: 'i' } }
      ];
    }

    const [devices, total] = await Promise.all([
      Device.find(filter)
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit)),
      Device.countDocuments(filter)
    ]);

    res.json({
      success: true,
      devices,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error('Devices list hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/admin/devices/:id
 * Tek cihaz detayı
 */
router.get('/:id', async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Cihaz bulunamadı'
      });
    }

    // Cihaza yetkili kullanıcıları da getir
    const authorizedUsers = await Permission.find({ deviceId: device._id, isActive: true })
      .populate('userId', 'name email')
      .select('userId grantedAt');

    res.json({
      success: true,
      device,
      authorizedUsers: authorizedUsers.map(p => ({
        ...p.userId.toObject(),
        grantedAt: p.grantedAt
      }))
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
 * POST /api/admin/devices
 * Yeni cihaz oluştur
 */
router.post('/', async (req, res) => {
  try {
    const { name } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Cihaz adı zorunludur'
      });
    }

    // Benzersiz aktivasyon kodu oluştur
    let activationCode;
    let codeExists = true;

    while (codeExists) {
      activationCode = Device.generateActivationCode();
      codeExists = await Device.findOne({ activationCode });
    }

    // Cihaz oluştur
    const device = new Device({
      name,
      activationCode
    });

    await device.save();

    // Log
    await logDeviceAction(req.user, 'DEVICE_CREATE', device, req);

    res.status(201).json({
      success: true,
      message: 'Cihaz oluşturuldu',
      device
    });
  } catch (error) {
    console.error('Device create hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * PUT /api/admin/devices/:id
 * Cihaz güncelle
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, status } = req.body;

    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Cihaz bulunamadı'
      });
    }

    // Alanları güncelle
    if (name) device.name = name;
    if (status) device.status = status;

    await device.save();

    // Log
    await logDeviceAction(req.user, 'DEVICE_UPDATE', device, req);

    res.json({
      success: true,
      message: 'Cihaz güncellendi',
      device
    });
  } catch (error) {
    console.error('Device update hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * DELETE /api/admin/devices/:id
 * Cihaz sil
 */
router.delete('/:id', async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Cihaz bulunamadı'
      });
    }

    // Cihaza ait SMS'leri sil
    await SMS.deleteMany({ deviceId: device._id });

    // Cihaza ait yetkileri sil
    await Permission.deleteMany({ deviceId: device._id });

    // Kullanıcıların authorizedDevices listesinden kaldır
    const User = require('../../models/User');
    await User.updateMany(
      { authorizedDevices: device._id },
      { $pull: { authorizedDevices: device._id } }
    );

    // Log (silmeden önce)
    await logDeviceAction(req.user, 'DEVICE_DELETE', device, req);

    // Cihazı sil
    await Device.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Cihaz ve ilişkili tüm veriler silindi'
    });
  } catch (error) {
    console.error('Device delete hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * POST /api/admin/devices/:id/regenerate-code
 * Aktivasyon kodunu yeniden oluştur
 */
router.post('/:id/regenerate-code', async (req, res) => {
  try {
    const device = await Device.findById(req.params.id);

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Cihaz bulunamadı'
      });
    }

    // Yeni kod oluştur
    let newCode;
    let codeExists = true;

    while (codeExists) {
      newCode = Device.generateActivationCode();
      codeExists = await Device.findOne({ activationCode: newCode });
    }

    device.activationCode = newCode;
    device.isActivated = false;
    device.status = 'offline';

    await device.save();

    // Log
    await logDeviceAction(req.user, 'DEVICE_UPDATE', device, req, 'Aktivasyon kodu yenilendi');

    res.json({
      success: true,
      message: 'Aktivasyon kodu yenilendi',
      activationCode: newCode
    });
  } catch (error) {
    console.error('Regenerate code hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

module.exports = router;
