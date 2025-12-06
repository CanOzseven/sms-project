const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const Permission = require('../../models/Permission');
const { verifyToken, isAdmin } = require('../../middleware/auth');
const { logUserAction } = require('../../services/activityLogger');

// Tüm route'lar için auth middleware
router.use(verifyToken, isAdmin);

/**
 * GET /api/admin/users
 * Tüm kullanıcıları listele
 */
router.get('/', async (req, res) => {
  try {
    const { role, status, search, limit = 50, skip = 0 } = req.query;

    // Filtre oluştur
    const filter = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password')
        .populate('authorizedDevices', 'name status')
        .sort({ createdAt: -1 })
        .skip(parseInt(skip))
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    res.json({
      success: true,
      users,
      pagination: {
        total,
        limit: parseInt(limit),
        skip: parseInt(skip)
      }
    });
  } catch (error) {
    console.error('Users list hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/admin/users/:id
 * Tek kullanıcı detayı
 */
router.get('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('authorizedDevices', 'name model status lastSeen');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('User detail hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * POST /api/admin/users
 * Yeni kullanıcı oluştur
 */
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role = 'user', authorizedDevices = [], status = 'active' } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Ad, email ve şifre zorunludur'
      });
    }

    // Email kontrolü
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Bu email adresi zaten kullanılıyor'
      });
    }

    // Şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Kullanıcı oluştur
    const user = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      authorizedDevices,
      status
    });

    await user.save();

    // Yetkileri oluştur
    if (authorizedDevices.length > 0) {
      const permissions = authorizedDevices.map(deviceId => ({
        userId: user._id,
        deviceId,
        grantedBy: req.user._id
      }));
      await Permission.insertMany(permissions, { ordered: false }).catch(() => {});
    }

    // Log
    await logUserAction(req.user, 'USER_CREATE', user, req);

    res.status(201).json({
      success: true,
      message: 'Kullanıcı oluşturuldu',
      user: await User.findById(user._id).select('-password').populate('authorizedDevices', 'name')
    });
  } catch (error) {
    console.error('User create hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * PUT /api/admin/users/:id
 * Kullanıcı güncelle
 */
router.put('/:id', async (req, res) => {
  try {
    const { name, email, password, role, authorizedDevices, status } = req.body;

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Kendi admin hesabını user yapamaz
    if (req.user._id.toString() === user._id.toString() && role === 'user') {
      return res.status(400).json({
        success: false,
        message: 'Kendi admin yetkinizi kaldıramazsınız'
      });
    }

    // Email değişiyorsa duplicate kontrolü
    if (email && email.toLowerCase() !== user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Bu email adresi zaten kullanılıyor'
        });
      }
      user.email = email.toLowerCase();
    }

    // Alanları güncelle
    if (name) user.name = name;
    if (role) user.role = role;
    if (status) user.status = status;

    // Şifre değişiyorsa hashle
    if (password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(password, salt);
    }

    // Yetkili cihazları güncelle
    if (authorizedDevices !== undefined) {
      // Eski yetkileri kaldır
      await Permission.deleteMany({ userId: user._id });

      // Yeni yetkileri ekle
      if (authorizedDevices.length > 0) {
        const permissions = authorizedDevices.map(deviceId => ({
          userId: user._id,
          deviceId,
          grantedBy: req.user._id
        }));
        await Permission.insertMany(permissions, { ordered: false }).catch(() => {});
      }

      user.authorizedDevices = authorizedDevices;
    }

    await user.save();

    // Log
    await logUserAction(req.user, 'USER_UPDATE', user, req);

    res.json({
      success: true,
      message: 'Kullanıcı güncellendi',
      user: await User.findById(user._id).select('-password').populate('authorizedDevices', 'name')
    });
  } catch (error) {
    console.error('User update hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Kullanıcı sil
 */
router.delete('/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Kendini silemez
    if (req.user._id.toString() === user._id.toString()) {
      return res.status(400).json({
        success: false,
        message: 'Kendinizi silemezsiniz'
      });
    }

    // Yetkilerini sil
    await Permission.deleteMany({ userId: user._id });

    // Kullanıcıyı sil
    await User.findByIdAndDelete(req.params.id);

    // Log
    await logUserAction(req.user, 'USER_DELETE', user, req);

    res.json({
      success: true,
      message: 'Kullanıcı silindi'
    });
  } catch (error) {
    console.error('User delete hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

module.exports = router;
