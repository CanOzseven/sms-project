const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../../models/User');
const { verifyToken } = require('../../middleware/auth');
const { logActivity } = require('../../services/activityLogger');

// Tüm route'lar için auth middleware
router.use(verifyToken);

/**
 * GET /api/user/profile
 * Kullanıcı profilini getir
 */
router.get('/', async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-password')
      .populate('authorizedDevices', 'name model status');

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
    console.error('Profile get hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * PUT /api/user/profile
 * Kullanıcı profilini güncelle
 */
router.put('/', async (req, res) => {
  try {
    const { name, email, currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // İsim güncelleme
    if (name && name.trim()) {
      user.name = name.trim();
    }

    // Email güncelleme
    if (email && email.toLowerCase() !== user.email) {
      // Email kullanılıyor mu kontrol et
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: user._id }
      });

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Bu email adresi zaten kullanılıyor'
        });
      }

      user.email = email.toLowerCase();
    }

    // Şifre güncelleme
    if (newPassword) {
      // Mevcut şifre kontrolü
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: 'Şifre değiştirmek için mevcut şifrenizi girmelisiniz'
        });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);

      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Mevcut şifreniz yanlış'
        });
      }

      // Yeni şifre minimum uzunluk kontrolü
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Yeni şifre en az 6 karakter olmalıdır'
        });
      }

      // Yeni şifreyi hashle
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);

      // Log
      await logActivity(
        user._id,
        'PASSWORD_CHANGE',
        'Kullanıcı şifresini değiştirdi',
        req
      );
    }

    await user.save();

    res.json({
      success: true,
      message: 'Profil güncellendi',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Profile update hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/user/profile/activity
 * Kullanıcının aktivite geçmişini getir
 */
router.get('/activity', async (req, res) => {
  try {
    const { limit = 50 } = req.query;

    const ActivityLog = require('../../models/ActivityLog');

    const activities = await ActivityLog.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .populate('deviceId', 'name')
      .lean();

    res.json({
      success: true,
      activities
    });
  } catch (error) {
    console.error('Activity hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * DELETE /api/user/profile
 * Kullanıcı hesabını sil (kendi hesabını)
 */
router.delete('/', async (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Hesabı silmek için şifrenizi girmelisiniz'
      });
    }

    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı'
      });
    }

    // Admin kendi hesabını silemez
    if (user.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Admin hesapları bu şekilde silinemez'
      });
    }

    // Şifre kontrolü
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Şifre yanlış'
      });
    }

    // Yetkileri sil
    const Permission = require('../../models/Permission');
    await Permission.deleteMany({ userId: user._id });

    // Kullanıcıyı sil
    await User.findByIdAndDelete(user._id);

    res.json({
      success: true,
      message: 'Hesabınız silindi'
    });
  } catch (error) {
    console.error('Account delete hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

module.exports = router;
