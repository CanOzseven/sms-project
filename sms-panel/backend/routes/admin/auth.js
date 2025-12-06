const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const { generateToken, verifyToken, isAdmin } = require('../../middleware/auth');
const { logLogin } = require('../../services/activityLogger');

/**
 * POST /api/admin/login
 * Admin girişi
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email ve şifre gerekli'
      });
    }

    // Kullanıcıyı bul
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      await logLogin({ email }, req, false);
      return res.status(401).json({
        success: false,
        message: 'Geçersiz email veya şifre'
      });
    }

    // Admin kontrolü
    if (user.role !== 'admin') {
      await logLogin(user, req, false);
      return res.status(403).json({
        success: false,
        message: 'Bu panel sadece adminler içindir'
      });
    }

    // Hesap aktif mi
    if (user.status !== 'active') {
      await logLogin(user, req, false);
      return res.status(403).json({
        success: false,
        message: 'Hesabınız devre dışı bırakılmış'
      });
    }

    // Şifre kontrolü
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      await logLogin(user, req, false);
      return res.status(401).json({
        success: false,
        message: 'Geçersiz email veya şifre'
      });
    }

    // Son giriş zamanını güncelle
    user.lastLogin = new Date();
    await user.save();

    // Token oluştur
    const token = generateToken(user._id, user.role);

    // Başarılı girişi logla
    await logLogin(user, req, true);

    res.json({
      success: true,
      message: 'Giriş başarılı',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Admin login hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/admin/me
 * Mevcut admin bilgilerini getir
 */
router.get('/me', verifyToken, isAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Admin me hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/admin/stats
 * Dashboard istatistikleri
 */
router.get('/stats', verifyToken, isAdmin, async (req, res) => {
  try {
    const User = require('../../models/User');
    const Device = require('../../models/Device');
    const SMS = require('../../models/SMS');

    // Paralel olarak tüm istatistikleri al
    const [totalUsers, totalDevices, onlineDevices, totalSMS] = await Promise.all([
      User.countDocuments({ role: 'user' }),
      Device.countDocuments(),
      Device.countDocuments({ status: 'online' }),
      SMS.countDocuments()
    ]);

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalDevices,
        onlineDevices,
        totalSMS
      }
    });
  } catch (error) {
    console.error('Stats hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/admin/activity-logs
 * Aktivite loglarını getir
 */
router.get('/activity-logs', verifyToken, isAdmin, async (req, res) => {
  try {
    const { getRecentActivities } = require('../../services/activityLogger');

    const { userId, deviceId, action, limit = 100 } = req.query;

    const activities = await getRecentActivities(parseInt(limit), {
      userId,
      deviceId,
      action
    });

    res.json({
      success: true,
      activities
    });
  } catch (error) {
    console.error('Activity logs hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

module.exports = router;
