const express = require('express');
const router = express.Router();
const Device = require('../../models/Device');
const { logDeviceAction } = require('../../services/activityLogger');

/**
 * POST /api/device/activate
 * Cihazı aktive et
 * Header: activation-code
 * Body: { model, androidId }
 */
router.post('/activate', async (req, res) => {
  try {
    // Aktivasyon kodunu header'dan al
    const activationCode = req.headers['activation-code'] || req.headers['x-activation-code'];

    if (!activationCode) {
      return res.status(400).json({
        success: false,
        message: 'Aktivasyon kodu gerekli (header: activation-code)'
      });
    }

    const { model, androidId } = req.body;

    // Cihazı bul
    const device = await Device.findOne({
      activationCode: activationCode.toUpperCase()
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Geçersiz aktivasyon kodu'
      });
    }

    // Cihaz bilgilerini güncelle
    device.model = model || device.model;
    device.androidId = androidId || device.androidId;
    device.isActivated = true;
    device.activatedAt = device.activatedAt || new Date();
    device.status = 'online';
    device.lastSeen = new Date();

    await device.save();

    // Log
    await logDeviceAction(null, 'DEVICE_ACTIVATE', device, req, `Cihaz aktive edildi: ${device.name}`);

    res.json({
      success: true,
      message: 'Cihaz başarıyla aktive edildi',
      device: {
        id: device._id,
        name: device.name,
        model: device.model,
        status: device.status,
        activatedAt: device.activatedAt
      }
    });
  } catch (error) {
    console.error('Device activate hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/device/status
 * Cihaz durumunu kontrol et
 * Header: activation-code
 */
router.get('/status', async (req, res) => {
  try {
    const activationCode = req.headers['activation-code'] || req.headers['x-activation-code'];

    if (!activationCode) {
      return res.status(400).json({
        success: false,
        message: 'Aktivasyon kodu gerekli'
      });
    }

    const device = await Device.findOne({
      activationCode: activationCode.toUpperCase()
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Geçersiz aktivasyon kodu'
      });
    }

    res.json({
      success: true,
      device: {
        id: device._id,
        name: device.name,
        model: device.model,
        status: device.status,
        isActivated: device.isActivated,
        totalSMS: device.totalSMS,
        lastSeen: device.lastSeen
      }
    });
  } catch (error) {
    console.error('Device status hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * POST /api/device/deactivate
 * Cihazı deaktive et (Android uygulamasından)
 * Header: activation-code
 */
router.post('/deactivate', async (req, res) => {
  try {
    const activationCode = req.headers['activation-code'] || req.headers['x-activation-code'];

    if (!activationCode) {
      return res.status(400).json({
        success: false,
        message: 'Aktivasyon kodu gerekli'
      });
    }

    const device = await Device.findOne({
      activationCode: activationCode.toUpperCase()
    });

    if (!device) {
      return res.status(404).json({
        success: false,
        message: 'Geçersiz aktivasyon kodu'
      });
    }

    device.status = 'offline';
    device.lastSeen = new Date();
    await device.save();

    // Log
    await logDeviceAction(null, 'DEVICE_OFFLINE', device, req, `Cihaz deaktive edildi: ${device.name}`);

    res.json({
      success: true,
      message: 'Cihaz deaktive edildi'
    });
  } catch (error) {
    console.error('Device deactivate hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

module.exports = router;
