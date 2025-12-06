const ActivityLog = require('../models/ActivityLog');

/**
 * Aktivite loglama servisi
 * Sistem genelinde tutarlı log kaydı için kullanılır
 */

/**
 * Genel aktivite logla
 * @param {ObjectId} userId - İşlemi yapan kullanıcı
 * @param {string} action - Aksiyon tipi
 * @param {string} details - Detay açıklaması
 * @param {Object} req - Express request objesi
 * @param {Object} extra - Ekstra bilgiler (deviceId, smsId, targetUserId, metadata)
 */
async function logActivity(userId, action, details, req, extra = {}) {
  try {
    const logData = {
      userId,
      action,
      details,
      ipAddress: getClientIP(req),
      userAgent: req?.headers?.['user-agent'] || '',
      ...extra
    };

    await ActivityLog.create(logData);
  } catch (error) {
    // Log hatası ana işlemi durdurmamalı
    console.error('Activity log hatası:', error.message);
  }
}

/**
 * Login aktivitesi logla
 */
async function logLogin(user, req, success = true) {
  await logActivity(
    success ? user._id : null,
    success ? 'LOGIN' : 'LOGIN_FAILED',
    success
      ? `${user.email} başarıyla giriş yaptı`
      : `Başarısız giriş denemesi: ${user?.email || 'Bilinmeyen'}`,
    req,
    {
      metadata: {
        email: user?.email,
        role: user?.role
      }
    }
  );
}

/**
 * Kullanıcı işlemleri logla
 */
async function logUserAction(adminUser, action, targetUser, req, details = '') {
  await logActivity(
    adminUser._id,
    action,
    details || `${targetUser.name} (${targetUser.email}) - ${action}`,
    req,
    {
      targetUserId: targetUser._id,
      metadata: {
        targetEmail: targetUser.email,
        targetName: targetUser.name
      }
    }
  );
}

/**
 * Cihaz işlemleri logla
 */
async function logDeviceAction(user, action, device, req, details = '') {
  await logActivity(
    user?._id || null,
    action,
    details || `${device.name} - ${action}`,
    req,
    {
      deviceId: device._id,
      metadata: {
        deviceName: device.name,
        activationCode: device.activationCode
      }
    }
  );
}

/**
 * SMS işlemleri logla
 */
async function logSMSAction(user, action, sms, device, req, details = '') {
  await logActivity(
    user?._id || null,
    action,
    details || `SMS ${action.toLowerCase()} - ${device?.name || 'Bilinmeyen cihaz'}`,
    req,
    {
      deviceId: device?._id,
      smsId: sms?._id,
      metadata: {
        phoneNumber: sms?.phoneNumber,
        messagePreview: sms?.message?.substring(0, 50)
      }
    }
  );
}

/**
 * Yetki işlemleri logla
 */
async function logPermissionAction(adminUser, action, targetUser, device, req) {
  await logActivity(
    adminUser._id,
    action,
    `${targetUser.name} -> ${device.name} - ${action === 'PERMISSION_GRANT' ? 'Yetki verildi' : 'Yetki kaldırıldı'}`,
    req,
    {
      targetUserId: targetUser._id,
      deviceId: device._id,
      metadata: {
        targetEmail: targetUser.email,
        deviceName: device.name
      }
    }
  );
}

/**
 * Client IP adresini al
 */
function getClientIP(req) {
  if (!req) return '';

  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
         req.headers['x-real-ip'] ||
         req.connection?.remoteAddress ||
         req.socket?.remoteAddress ||
         req.ip ||
         '';
}

/**
 * Son aktiviteleri getir
 */
async function getRecentActivities(limit = 50, filter = {}) {
  try {
    const query = {};

    if (filter.userId) query.userId = filter.userId;
    if (filter.deviceId) query.deviceId = filter.deviceId;
    if (filter.action) query.action = filter.action;
    if (filter.startDate || filter.endDate) {
      query.timestamp = {};
      if (filter.startDate) query.timestamp.$gte = new Date(filter.startDate);
      if (filter.endDate) query.timestamp.$lte = new Date(filter.endDate);
    }

    return await ActivityLog.find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .populate('userId', 'name email')
      .populate('deviceId', 'name')
      .populate('targetUserId', 'name email')
      .lean();
  } catch (error) {
    console.error('Aktivite getirme hatası:', error.message);
    return [];
  }
}

module.exports = {
  logActivity,
  logLogin,
  logUserAction,
  logDeviceAction,
  logSMSAction,
  logPermissionAction,
  getRecentActivities,
  getClientIP
};
