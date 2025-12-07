package com.smspanel

import android.app.*
import android.content.ContentResolver
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.database.Cursor
import android.net.Uri
import android.os.Build
import android.os.IBinder
import android.provider.ContactsContract
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import com.google.gson.Gson
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class SMSBackgroundService : Service() {

    private lateinit var prefs: SharedPreferences
    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    private var heartbeatJob: Job? = null
    private var syncJob: Job? = null

    companion object {
        private const val NOTIFICATION_ID = 1001
        private const val CHANNEL_ID = "sms_panel_channel"
        private const val HEARTBEAT_INTERVAL = 30 * 1000L // 30 saniye
        private const val SYNC_INTERVAL = 5 * 1000L // 5 saniye
    }

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences("SMSPanel", MODE_PRIVATE)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        android.util.Log.d("SMSPanel", "========================================")
        android.util.Log.d("SMSPanel", "SERVICE BAŞLATILDI")
        android.util.Log.d("SMSPanel", "Heartbeat interval: ${HEARTBEAT_INTERVAL / 1000} saniye")
        android.util.Log.d("SMSPanel", "Sync interval: ${SYNC_INTERVAL / 1000} saniye")
        android.util.Log.d("SMSPanel", "========================================")

        sendLogBroadcast("⚡ Servis başlatıldı (Heartbeat: ${HEARTBEAT_INTERVAL / 1000}s, Sync: ${SYNC_INTERVAL / 1000}s)")

        startForeground(NOTIFICATION_ID, createNotification())

        // İlk heartbeat'i hemen at
        scope.launch {
            android.util.Log.d("SMSPanel", "İlk heartbeat gönderiliyor...")
            sendLogBroadcast("📡 İlk heartbeat gönderiliyor...")
            sendHeartbeat()
            delay(1000) // 1 saniye bekle
            android.util.Log.d("SMSPanel", "İlk SMS sync başlatılıyor...")
            sendLogBroadcast("🔄 İlk SMS sync başlatılıyor...")
            syncAllSMS() // İlk sync'i de hemen yap
        }

        // Periyodik çalışmaları başlat
        startHeartbeat()
        startPeriodicSync()

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        heartbeatJob?.cancel()
        syncJob?.cancel()
        scope.cancel()
    }

    private fun sendLogBroadcast(message: String) {
        val intent = Intent(MainActivity.ACTION_LOG)
        intent.putExtra(MainActivity.EXTRA_LOG_MESSAGE, message)
        sendBroadcast(intent)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "SMS Panel Service",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "SMS Panel arka plan servisi"
                setShowBadge(false)
            }

            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }
    }

    private fun createNotification(): Notification {
        val intent = Intent(this, MainActivity::class.java)
        val pendingIntent = PendingIntent.getActivity(
            this, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("SMS Panel")
            .setContentText("SMS senkronizasyonu aktif")
            .setSmallIcon(R.drawable.ic_notification)
            .setContentIntent(pendingIntent)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = scope.launch {
            while (isActive) {
                sendHeartbeat()
                delay(HEARTBEAT_INTERVAL)
            }
        }
    }

    private fun startPeriodicSync() {
        syncJob?.cancel()
        syncJob = scope.launch {
            while (isActive) {
                delay(SYNC_INTERVAL)
                syncAllSMS()
            }
        }
    }

    private suspend fun sendHeartbeat() {
        val serverUrl = prefs.getString("serverUrl", null)
        val activationCode = prefs.getString("activationCode", null)

        android.util.Log.d("SMSPanel", ">>> HEARTBEAT <<<")
        android.util.Log.d("SMSPanel", "Server URL: $serverUrl")
        android.util.Log.d("SMSPanel", "Activation Code: ${activationCode?.take(4)}****")

        if (serverUrl == null || activationCode == null) {
            android.util.Log.e("SMSPanel", "SERVER URL veya ACTIVATION CODE yok!")
            return
        }

        val url = "$serverUrl/api/device/heartbeat"
        android.util.Log.d("SMSPanel", "Heartbeat URL: $url")

        val client = OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        val request = Request.Builder()
            .url(url)
            .addHeader("activation-code", activationCode)
            .addHeader("Content-Type", "application/json")
            .post("{}".toRequestBody("application/json".toMediaType()))
            .build()

        try {
            val startTime = System.currentTimeMillis()
            client.newCall(request).execute().use { response ->
                val duration = System.currentTimeMillis() - startTime
                if (response.isSuccessful) {
                    android.util.Log.d("SMSPanel", "✓ Heartbeat başarılı (${duration}ms)")
                    sendLogBroadcast("✓ Heartbeat başarılı (${duration}ms)")
                } else {
                    android.util.Log.e("SMSPanel", "✗ Heartbeat başarısız: ${response.code} - ${response.message}")
                    android.util.Log.e("SMSPanel", "Response body: ${response.body?.string()}")
                    sendLogBroadcast("✗ Heartbeat başarısız: ${response.code}")
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("SMSPanel", "✗ Heartbeat EXCEPTION: ${e.javaClass.simpleName}")
            android.util.Log.e("SMSPanel", "✗ Heartbeat hatası: ${e.message}")
            e.printStackTrace()
            sendLogBroadcast("✗ Heartbeat hatası: ${e.message}")
        }
    }

    private suspend fun syncAllSMS() {
        val serverUrl = prefs.getString("serverUrl", null)
        val activationCode = prefs.getString("activationCode", null)

        android.util.Log.d("SMSPanel", ">>> SMS SYNC <<<")

        if (serverUrl == null || activationCode == null) {
            android.util.Log.e("SMSPanel", "SERVER URL veya ACTIVATION CODE yok!")
            return
        }

        // İlk kurulum zamanını kontrol et
        var installTimestamp = prefs.getLong("installTimestamp", 0)
        if (installTimestamp == 0L) {
            // İlk kez çalışıyor, şu anki zamanı kaydet
            installTimestamp = System.currentTimeMillis()
            prefs.edit().putLong("installTimestamp", installTimestamp).apply()
            android.util.Log.d("SMSPanel", "İlk kurulum zamanı kaydedildi: $installTimestamp")
            sendLogBroadcast("⚙️ Kurulum zamanı kaydedildi")
        }

        // Kurulum zamanından sonraki SMS'leri oku
        val messages = readSMSMessages(installTimestamp)
        android.util.Log.d("SMSPanel", "Cihazdan okunan SMS sayısı: ${messages.size}")

        if (messages.isEmpty()) {
            android.util.Log.d("SMSPanel", "Yeni SMS yok, sync atlanıyor")
            return
        }

        android.util.Log.d("SMSPanel", ">>> ${messages.size} SMS SENKRONIZE EDILECEK <<<")
        sendLogBroadcast("📤 ${messages.size} SMS senkronize ediliyor...")

        val url = "$serverUrl/api/device/sms"
        val json = gson.toJson(mapOf("messages" to messages))
        android.util.Log.d("SMSPanel", "Sync URL: $url")
        android.util.Log.d("SMSPanel", "JSON boyutu: ${json.length} karakter")

        val client = OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()

        val request = Request.Builder()
            .url(url)
            .addHeader("activation-code", activationCode)
            .addHeader("Content-Type", "application/json")
            .post(json.toRequestBody("application/json".toMediaType()))
            .build()

        try {
            val startTime = System.currentTimeMillis()
            android.util.Log.d("SMSPanel", "HTTP POST gönderiliyor...")

            client.newCall(request).execute().use { response ->
                val duration = System.currentTimeMillis() - startTime
                android.util.Log.d("SMSPanel", "HTTP yanıt alındı (${duration}ms)")
                android.util.Log.d("SMSPanel", "Response code: ${response.code}")

                if (response.isSuccessful) {
                    val body = response.body?.string()
                    android.util.Log.d("SMSPanel", "Response body: $body")

                    val result = gson.fromJson(body, Map::class.java)
                    val synced = (result["synced"] as? Double)?.toInt() ?: 0
                    val duplicates = (result["duplicates"] as? Double)?.toInt() ?: 0

                    // İstatistikleri güncelle
                    val totalSynced = prefs.getInt("syncedSms", 0) + synced
                    prefs.edit()
                        .putInt("syncedSms", totalSynced)
                        .putLong("lastSync", System.currentTimeMillis())
                        .apply()

                    android.util.Log.d("SMSPanel", "✓ $synced SMS senkronize edildi, $duplicates duplicate (Toplam: $totalSynced)")
                    sendLogBroadcast("✓ $synced yeni SMS, $duplicates duplicate (Toplam: $totalSynced)")
                } else {
                    android.util.Log.e("SMSPanel", "✗ Sync başarısız: ${response.code} - ${response.message}")
                    android.util.Log.e("SMSPanel", "Response body: ${response.body?.string()}")
                    sendLogBroadcast("✗ Sync başarısız: ${response.code}")
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("SMSPanel", "✗ SMS SYNC EXCEPTION: ${e.javaClass.simpleName}")
            android.util.Log.e("SMSPanel", "✗ SMS sync hatası: ${e.message}")
            e.printStackTrace()
            sendLogBroadcast("✗ Sync hatası: ${e.message}")
        }
    }

    private fun readSMSMessages(sinceTimestamp: Long): List<Map<String, Any>> {
        val messages = mutableListOf<Map<String, Any>>()

        val uri = Telephony.Sms.CONTENT_URI
        val projection = arrayOf(
            Telephony.Sms._ID,
            Telephony.Sms.ADDRESS,
            Telephony.Sms.BODY,
            Telephony.Sms.DATE,
            Telephony.Sms.TYPE,
            Telephony.Sms.PERSON
        )

        // Kurulum zamanından sonraki SMS'leri filtrele
        val selection = "${Telephony.Sms.DATE} > ?"
        val selectionArgs = arrayOf(sinceTimestamp.toString())

        // En yeni SMS'ler önce gelsin
        val sortOrder = "${Telephony.Sms.DATE} DESC"

        android.util.Log.d("SMSPanel", "SMS okuma başlıyor - Kurulum zamanı: $sinceTimestamp")

        try {
            contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)?.use { cursor ->
                val totalFound = cursor.count
                android.util.Log.d("SMSPanel", "Cursor'da toplam $totalFound SMS bulundu")

                var readCount = 0
                while (cursor.moveToNext() && readCount < 500) { // Max 500 SMS
                    try {
                        val smsId = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms._ID))
                        val address = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS))
                        val body = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.BODY))
                        val date = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.DATE))
                        val type = cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Sms.TYPE))

                        // Geçersiz veri kontrolü
                        if (address.isNullOrBlank() || body == null) {
                            android.util.Log.w("SMSPanel", "SMS ID $smsId: Geçersiz veri, atlanıyor")
                            continue
                        }

                        val smsType = when (type) {
                            Telephony.Sms.MESSAGE_TYPE_INBOX -> "received"
                            Telephony.Sms.MESSAGE_TYPE_SENT -> "sent"
                            else -> "received"
                        }

                        val contactName = getContactName(address)

                        messages.add(mapOf(
                            "smsId" to smsId,
                            "phoneNumber" to address,
                            "contactName" to contactName,
                            "message" to body,
                            "type" to smsType,
                            "timestamp" to date
                        ))

                        readCount++

                        if (readCount <= 5) {
                            android.util.Log.d("SMSPanel", "SMS #$readCount: ID=$smsId, From=$address, Type=$smsType, Date=$date")
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("SMSPanel", "SMS okuma hatası (cursor): ${e.message}")
                    }
                }

                android.util.Log.d("SMSPanel", "Toplam $readCount SMS okundu")
            }

            // Toplam SMS sayısını güncelle
            val totalCount = getTotalSMSCount()
            prefs.edit()
                .putInt("totalSms", totalCount)
                .apply()

        } catch (e: Exception) {
            android.util.Log.e("SMSPanel", "SMS okuma hatası (genel): ${e.message}")
            e.printStackTrace()
        }

        android.util.Log.d("SMSPanel", "readSMSMessages tamamlandı: ${messages.size} SMS")
        return messages
    }

    private fun getTotalSMSCount(): Int {
        val uri = Telephony.Sms.CONTENT_URI
        return try {
            contentResolver.query(uri, arrayOf("_id"), null, null, null)?.use {
                it.count
            } ?: 0
        } catch (e: Exception) {
            0
        }
    }

    private fun getContactName(phoneNumber: String): String {
        val uri = Uri.withAppendedPath(
            ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
            Uri.encode(phoneNumber)
        )

        return try {
            contentResolver.query(
                uri,
                arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                null, null, null
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    cursor.getString(0) ?: ""
                } else ""
            } ?: ""
        } catch (e: Exception) {
            ""
        }
    }

    // Tek SMS gönderme (BroadcastReceiver'dan çağrılır)
    fun sendSingleSMS(phoneNumber: String, contactName: String, message: String, type: String, timestamp: Long) {
        scope.launch {
            val serverUrl = prefs.getString("serverUrl", null) ?: return@launch
            val activationCode = prefs.getString("activationCode", null) ?: return@launch

            sendLogBroadcast("📨 Yeni SMS alındı: ${contactName.ifEmpty { phoneNumber }}")

            val url = "$serverUrl/api/device/sms/single"
            val json = gson.toJson(mapOf(
                "phoneNumber" to phoneNumber,
                "contactName" to contactName,
                "message" to message,
                "type" to type,
                "timestamp" to timestamp
            ))

            val client = OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(30, TimeUnit.SECONDS)
                .build()

            val request = Request.Builder()
                .url(url)
                .addHeader("activation-code", activationCode)
                .addHeader("Content-Type", "application/json")
                .post(json.toRequestBody("application/json".toMediaType()))
                .build()

            try {
                client.newCall(request).execute().use { response ->
                    if (response.isSuccessful) {
                        android.util.Log.d("SMSPanel", "Tek SMS gönderildi: $phoneNumber")
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("SMSPanel", "Tek SMS gönderme hatası: ${e.message}")
            }
        }
    }
}
