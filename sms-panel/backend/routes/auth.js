const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');
const { logLogin } = require('../services/activityLogger');

/**
 * POST /api/auth/login
 * Unified login - role'e göre token döndürür
 */
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validation
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Kullanıcı adı ve şifre gerekli'
      });
    }

    // Kullanıcıyı bul
    const user = await User.findOne({ username: username.toLowerCase() });

    if (!user) {
      await logLogin({ username }, req, false);
      return res.status(401).json({
        success: false,
        message: 'Geçersiz kullanıcı adı veya şifre'
      });
    }

    // Hesap aktif mi kontrol et
    if (user.status !== 'active') {
      await logLogin(user, req, false);
      return res.status(403).json({
        success: false,
        message: 'Hesabınız devre dışı bırakılmış. Yönetici ile iletişime geçin.'
      });
    }

    // Şifre kontrolü
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      await logLogin(user, req, false);
      return res.status(401).json({
        success: false,
        message: 'Geçersiz kullanıcı adı veya şifre'
      });
    }

    // Token oluştur
    const token = generateToken(user._id, user.role);

    // Son giriş zamanını ve aktif session token'ı güncelle (single session)
    user.lastLogin = new Date();
    user.currentSessionToken = token;
    await user.save();

    // Başarılı girişi logla
    await logLogin(user, req, true);

    res.json({
      success: true,
      message: 'Giriş başarılı',
      token,
      user: {
        id: user._id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

module.exports = router;
