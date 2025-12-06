const express = require('express');
const router = express.Router();
const Permission = require('../../models/Permission');
const User = require('../../models/User');
const Device = require('../../models/Device');
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { logPermissionAction } = require('../../services/activityLogger');

// Tüm route'lar için auth middleware
router.use(verifyToken, isAdmin);

/**
 * GET /api/admin/permissions
 * Tüm yetkileri listele
 */
router.get('/', async (req, res) => {
  try {
    const { userId, deviceId, limit = 100, skip = 0 } = req.query;

    // Filtre oluştur
    const filter = { isActive: true };
    if (userId) filter.userId = userId;
    if (deviceId) filter.deviceId = deviceId;

    const [permissions, total] = await Promise.all([
      Permission.find(filter)
        .populate('userId', 'name email role status')
        .populate('deviceId', 'name model status')
        .populate('grantedBy', 'name email')
        .sort({ grantedAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit)),
      Permission.countDocuments(filter)
    ]);

    res.json({
      success: true,
      permissions,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error('Permissions list hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * POST /api/admin/permissions/grant
 * Yetki ver
 */
router.post('/grant', async (req, res) => {
  try {
    const { userId, deviceId, notes = '' } = req.body;

    // Validation
    if (!userId || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı ID ve Cihaz ID zorunludur'
      });
    }

    // Kullanıcı var mı kontrol et
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Cihaz var mı kontrol et
    const device = await Device.findById(deviceId);
    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Cihaz bulunamadı'
      });
    }

    // Zaten yetki var mı kontrol et
    const existingPermission = await Permission.findOne({ userId, deviceId });

    if (existingPermission) {
      if (existingPermission.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Bu kullanıcının zaten bu cihaza yetkisi var'
        });
      }
      // Pasif yetkiyi aktifle
      existingPermission.isActive = true;
      existingPermission.grantedAt = new Date();
      existingPermission.grantedBy = req.user._id;
      existingPermission.notes = notes;
      await existingPermission.save();
    } else {
      // Yeni yetki oluştur
      await Permission.create({
        userId,
        deviceId,
        grantedBy: req.user._id,
        notes
      });
    }

    // Kullanıcının authorizedDevices listesine ekle
    if (!user.authorizedDevices.includes(deviceId)) {
      user.authorizedDevices.push(deviceId);
      await user.save();
    }

    // Log
    await logPermissionAction(req.user, 'PERMISSION_GRANT', user, device, req);

    res.json({
      success: true,
      message: `${user.name} kullanıcısına ${device.name} cihazı için yetki verildi`
    });
  } catch (error) {
    console.error('Permission grant hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * DELETE /api/admin/permissions/revoke
 * Yetki kaldır
 */
router.delete('/revoke', async (req, res) => {
  try {
    const { userId, deviceId } = req.body;

    // Validation
    if (!userId || !deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı ID ve Cihaz ID zorunludur'
      });
    }

    // Kullanıcı ve cihazı bul
    const [user, device, permission] = await Promise.all([
      User.findById(userId),
      Device.findById(deviceId),
      Permission.findOne({ userId, deviceId, isActive: true })
    ]);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Cihaz bulunamadı'
      });
    }

    if (!permission) {
      return res.status(404).json({
        success: false,
        message: 'Yetki bulunamadı'
      });
    }

    // Yetkiyi pasifle
    permission.isActive = false;
    await permission.save();

    // Kullanıcının authorizedDevices listesinden kaldır
    user.authorizedDevices = user.authorizedDevices.filter(
      d => d.toString() !== deviceId
    );
    await user.save();

    // Log
    await logPermissionAction(req.user, 'PERMISSION_REVOKE', user, device, req);

    res.json({
      success: true,
      message: `${user.name} kullanıcısının ${device.name} cihazı yetkisi kaldırıldı`
    });
  } catch (error) {
    console.error('Permission revoke hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/admin/permissions/user/:userId
 * Kullanıcının yetkilerini getir
 */
router.get('/user/:userId', async (req, res) => {
  try {
    const permissions = await Permission.find({
      userId: req.params.userId,
      isActive: true
    })
      .populate('deviceId', 'name model status')
      .populate('grantedBy', 'name')
      .sort({ grantedAt: -1 });

    res.json({
      success: true,
      permissions
    });
  } catch (error) {
    console.error('User permissions hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/admin/permissions/device/:deviceId
 * Cihazın yetkili kullanıcılarını getir
 */
router.get('/device/:deviceId', async (req, res) => {
  try {
    const permissions = await Permission.find({
      deviceId: req.params.deviceId,
      isActive: true
    })
      .populate('userId', 'name email status')
      .populate('grantedBy', 'name')
      .sort({ grantedAt: -1 });

    res.json({
      success: true,
      permissions
    });
  } catch (error) {
    console.error('Device permissions hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

module.exports = router;
