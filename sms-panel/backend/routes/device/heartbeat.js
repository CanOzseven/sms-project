const express = require('express');
const router = express.Router();
const Device = require('../../models/Device');
const { deviceAuth } = require('../../middleware/auth');

/**
 * POST /api/device/heartbeat
 * Cihazın hayatta olduğunu bildir
 * Header: activation-code
 */
router.post('/heartbeat', deviceAuth, async (req, res) => {
  try {
    const device = req.device;

    // Cihaz durumunu güncelle
    const wasOffline = device.status === 'offline';

    device.status = 'online';
    device.lastSeen = new Date();
    await device.save();

    // Eğer offline'dan online'a geçtiyse log
    if (wasOffline) {
      const { logDeviceAction } = require('../../services/activityLogger');
      await logDeviceAction(null, 'DEVICE_ONLINE', device, req, `Cihaz online oldu: ${device.name}`);
    }

    res.json({
      success: true,
      message: 'Heartbeat alındı',
      device: {
        id: device._id,
        name: device.name,
        status: device.status,
        lastSeen: device.lastSeen
      }
    });
  } catch (error) {
    console.error('Heartbeat hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * Cihazları offline olarak işaretle (5 dakikadan fazla heartbeat yok)
 * Bu fonksiyon server.js'de interval ile çalıştırılabilir
 */
async function markOfflineDevices() {
  try {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const result = await Device.updateMany(
      {
        status: 'online',
        lastSeen: { $lt: fiveMinutesAgo }
      },
      {
        $set: { status: 'offline' }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`⚠️ ${result.modifiedCount} cihaz offline olarak işaretlendi`);
    }

    return result.modifiedCount;
  } catch (error) {
    console.error('Mark offline devices hatası:', error);
    return 0;
  }
}

/**
 * GET /api/device/ping
 * Basit bağlantı kontrolü (auth gerektirmez)
 */
router.get('/ping', (req, res) => {
  res.json({
    success: true,
    message: 'pong',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
module.exports.markOfflineDevices = markOfflineDevices;
