const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Device = require('../models/Device');
const Permission = require('../models/Permission');

/**
 * JWT Token doğrulama middleware
 */
const verifyToken = async (req, res, next) => {
  try {
    // Token'ı header'dan al
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Yetkilendirme token\'ı bulunamadı'
      });
    }

    const token = authHeader.split(' ')[1];

    // Token'ı doğrula
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Kullanıcıyı bul
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz token - kullanıcı bulunamadı'
      });
    }

    // Kullanıcı aktif mi kontrol et
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Hesabınız devre dışı bırakılmış'
      });
    }

    // Kullanıcıyı request'e ekle
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token süresi dolmuş'
      });
    }
    console.error('Token doğrulama hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
};

/**
 * Admin rolü kontrolü middleware
 */
const isAdmin = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Yetkilendirme gerekli'
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Bu işlem için admin yetkisi gerekli'
      });
    }

    next();
  } catch (error) {
    console.error('Admin kontrolü hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
};

/**
 * Cihaz aktivasyon kodu ile kimlik doğrulama
 */
const deviceAuth = async (req, res, next) => {
  try {
    // Aktivasyon kodunu header'dan al
    const activationCode = req.headers['activation-code'] || req.headers['x-activation-code'];

    if (!activationCode) {
      return res.status(401).json({
        success: false,
        message: 'Aktivasyon kodu bulunamadı'
      });
    }

    // Cihazı bul
    const device = await Device.findOne({
      activationCode: activationCode.toUpperCase()
    });

    if (!device) {
      return res.status(401).json({
        success: false,
        message: 'Geçersiz aktivasyon kodu'
      });
    }

    // Cihazı request'e ekle
    req.device = device;
    next();
  } catch (error) {
    console.error('Cihaz auth hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
};

/**
 * Kullanıcının belirli bir cihaza yetkisi var mı kontrol et
 */
const checkDevicePermission = async (req, res, next) => {
  try {
    const deviceId = req.params.deviceId || req.body.deviceId;

    if (!deviceId) {
      return res.status(400).json({
        success: false,
        message: 'Cihaz ID gerekli'
      });
    }

    // Admin her cihaza erişebilir
    if (req.user.role === 'admin') {
      return next();
    }

    // Kullanıcının yetkisini kontrol et
    const hasPermission = await Permission.hasPermission(req.user._id, deviceId);

    if (!hasPermission) {
      return res.status(403).json({
        success: false,
        message: 'Bu cihaza erişim yetkiniz yok'
      });
    }

    next();
  } catch (error) {
    console.error('Yetki kontrolü hatası:', error);
    return res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
};

/**
 * JWT Token oluştur
 */
const generateToken = (userId, role) => {
  return jwt.sign(
    { userId, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

module.exports = {
  verifyToken,
  isAdmin,
  deviceAuth,
  checkDevicePermission,
  generateToken
};
