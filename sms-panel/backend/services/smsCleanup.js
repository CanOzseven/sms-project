const SMS = require('../models/SMS');

/**
 * Eski SMS'leri temizle
 * @param {number} daysToKeep - Kaç günlük mesajlar tutulacak (default: 1)
 * @returns {Object} - Silinen mesaj sayısı
 */
async function cleanupOldMessages(daysToKeep = 1) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    cutoffDate.setHours(0, 0, 0, 0); // Günün başlangıcı

    console.log(`🗑️  SMS temizliği başlatılıyor... (${daysToKeep} günden eski mesajlar silinecek)`);
    console.log(`   Kesim tarihi: ${cutoffDate.toISOString()}`);

    const result = await SMS.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    const deletedCount = result.deletedCount || 0;

    if (deletedCount > 0) {
      console.log(`✅ ${deletedCount} adet eski SMS silindi`);
    } else {
      console.log(`ℹ️  Silinecek eski SMS bulunamadı`);
    }

    return {
      success: true,
      deletedCount,
      cutoffDate: cutoffDate.toISOString()
    };
  } catch (error) {
    console.error('❌ SMS temizliği hatası:', error);
    return {
      success: false,
      error: error.message,
      deletedCount: 0
    };
  }
}

/**
 * Belirli bir cihazın eski mesajlarını temizle
 * @param {string} deviceId - Cihaz ID
 * @param {number} daysToKeep - Kaç günlük mesajlar tutulacak
 * @returns {Object} - Silinen mesaj sayısı
 */
async function cleanupDeviceMessages(deviceId, daysToKeep = 1) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    cutoffDate.setHours(0, 0, 0, 0);

    const result = await SMS.deleteMany({
      deviceId,
      timestamp: { $lt: cutoffDate }
    });

    return {
      success: true,
      deletedCount: result.deletedCount || 0,
      cutoffDate: cutoffDate.toISOString()
    };
  } catch (error) {
    console.error('SMS temizliği hatası (device):', error);
    return {
      success: false,
      error: error.message,
      deletedCount: 0
    };
  }
}

/**
 * İstatistikleri getir
 * @returns {Object} - Toplam mesaj sayısı ve tarihe göre dağılım
 */
async function getCleanupStats() {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const [total, todayCount, yesterdayCount, oldCount] = await Promise.all([
      SMS.countDocuments(),
      SMS.countDocuments({ timestamp: { $gte: today } }),
      SMS.countDocuments({
        timestamp: {
          $gte: yesterday,
          $lt: today
        }
      }),
      SMS.countDocuments({ timestamp: { $lt: yesterday } })
    ]);

    return {
      total,
      today: todayCount,
      yesterday: yesterdayCount,
      older: oldCount
    };
  } catch (error) {
    console.error('Cleanup stats hatası:', error);
    return null;
  }
}

module.exports = {
  cleanupOldMessages,
  cleanupDeviceMessages,
  getCleanupStats
};
