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
import java.text.SimpleDateFormat
import java.util.*
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
        private const val HEARTBEAT_INTERVAL = 30 * 1000L // 30 saniye (test için)
        private const val SYNC_INTERVAL = 15 * 60 * 1000L // 15 dakika
    }

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences("SMSPanel", MODE_PRIVATE)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification())

        ActivityLogger.info(this, "BackgroundService", "🚀 Arka plan servisi başlatıldı", "Heartbeat: 30sn, Sync: 15dk")

        // İlk heartbeat'i hemen gönder
        scope.launch {
            delay(2000) // 2 saniye bekle
            sendHeartbeat()
        }

        // Periyodik heartbeat başlat
        startHeartbeat()
        startPeriodicSync()

        // İlk sync'i hemen yap
        scope.launch {
            delay(5000) // 5 saniye bekle
            syncAllSMS()
        }

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        super.onDestroy()
        heartbeatJob?.cancel()
        syncJob?.cancel()
        scope.cancel()
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
                delay(HEARTBEAT_INTERVAL) // 30 saniye bekle
                sendHeartbeat()
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
        val serverUrl = prefs.getString("serverUrl", null) ?: return
        val activationCode = prefs.getString("activationCode", null) ?: return

        val url = "$serverUrl/api/device/heartbeat"

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
            client.newCall(request).execute().use { response ->
                when {
                    response.isSuccessful -> {
                        ActivityLogger.info(this, "BackgroundService", "Heartbeat gönderildi ✓", null)
                    }
                    response.code == 401 || response.code == 404 -> {
                        // Cihaz backend'de yok veya silinmiş
                        ActivityLogger.error(
                            this,
                            "BackgroundService",
                            "Cihaz bulunamadı veya silinmiş!",
                            "HTTP ${response.code} - Ayarlar temizleniyor..."
                        )
                        MainActivity.clearDeviceAndRestart(
                            this,
                            "Heartbeat hatası: HTTP ${response.code} - Cihaz backend'de bulunamadı"
                        )
                    }
                    else -> {
                        ActivityLogger.warning(
                            this,
                            "BackgroundService",
                            "Heartbeat başarısız",
                            "HTTP ${response.code}"
                        )
                    }
                }
            }
        } catch (e: java.net.UnknownHostException) {
            ActivityLogger.error(this, "BackgroundService", "Heartbeat: Sunucuya bağlanılamadı", "DNS hatası")
        } catch (e: java.net.SocketTimeoutException) {
            ActivityLogger.error(this, "BackgroundService", "Heartbeat: Timeout", null)
        } catch (e: Exception) {
            ActivityLogger.error(
                this,
                "BackgroundService",
                "Heartbeat exception",
                "${e.javaClass.simpleName}: ${e.message}"
            )
        }
    }

    private suspend fun syncAllSMS() {
        try {
            val serverUrl = prefs.getString("serverUrl", null) ?: return
            val activationCode = prefs.getString("activationCode", null) ?: return

            // Son sync zamanını al
            val lastSyncTime = prefs.getLong("lastSyncTimestamp", 0)

            val lastSyncDate = if (lastSyncTime > 0) {
                val dateFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
                dateFormat.format(Date(lastSyncTime))
            } else "İlk senkronizasyon"

            ActivityLogger.info(
                this,
                "BackgroundService",
                "Periyodik SMS taraması başladı (15dk)",
                "Son tarama: $lastSyncDate"
            )

            // SMS'leri oku
            val messages = readSMSMessages(lastSyncTime)

            if (messages.isEmpty()) {
                ActivityLogger.info(
                    this,
                    "BackgroundService",
                    "Tarama tamamlandı: Yeni SMS yok ✓",
                    "Bir sonraki tarama 15 dakika sonra"
                )
                return
            }

            ActivityLogger.info(
                this,
                "BackgroundService",
                "📤 ${messages.size} yeni SMS bulundu",
                "Sunucuya gönderiliyor..."
            )

            val url = "$serverUrl/api/device/sms"
            val json = gson.toJson(mapOf("messages" to messages))

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

            client.newCall(request).execute().use { response ->
                val body = response.body?.string()

                when {
                    response.isSuccessful -> {
                        val result = gson.fromJson(body, Map::class.java)
                        val synced = (result["synced"] as? Double)?.toInt() ?: 0
                        val duplicates = (result["duplicates"] as? Double)?.toInt() ?: 0

                        // ÖNEMLI: lastSyncTimestamp'i okunan mesajların en son timestamp'ine ayarla
                        // Böylece bir sonraki sync'te sadece YENİ mesajları okur
                        val newLastSyncTime = if (messages.isNotEmpty()) {
                            // En son mesajın timestamp'ini al
                            messages.maxOfOrNull { (it["timestamp"] as? Long) ?: 0L } ?: System.currentTimeMillis()
                        } else {
                            System.currentTimeMillis()
                        }

                        // İstatistikleri güncelle
                        val totalSynced = prefs.getInt("syncedSms", 0) + synced
                        prefs.edit()
                            .putInt("syncedSms", totalSynced)
                            .putLong("lastSync", System.currentTimeMillis())
                            .putLong("lastSyncTimestamp", newLastSyncTime) // ÖNCEKİ hatalıydı!
                            .apply()

                        val resultMsg = if (duplicates > 0) {
                            "✓ $synced yeni SMS kaydedildi, $duplicates zaten vardı"
                        } else {
                            "✓ $synced SMS başarıyla kaydedildi"
                        }

                        ActivityLogger.success(
                            this,
                            "BackgroundService",
                            "Senkronizasyon tamamlandı",
                            resultMsg
                        )
                    }
                    response.code == 401 || response.code == 404 -> {
                        // Cihaz backend'de yok veya silinmiş
                        ActivityLogger.error(
                            this,
                            "BackgroundService",
                            "Cihaz bulunamadı veya silinmiş!",
                            "HTTP ${response.code} - Ayarlar temizleniyor..."
                        )
                        MainActivity.clearDeviceAndRestart(
                            this,
                            "SMS Sync hatası: HTTP ${response.code} - Cihaz backend'de bulunamadı"
                        )
                    }
                    else -> {
                        ActivityLogger.error(
                            this,
                            "BackgroundService",
                            "Sync başarısız",
                            "HTTP ${response.code}: ${body?.take(200)}"
                        )
                    }
                }
            }

        } catch (e: java.net.UnknownHostException) {
            ActivityLogger.error(this, "BackgroundService", "Sync: Sunucuya bağlanılamadı", "DNS hatası")
        } catch (e: java.net.SocketTimeoutException) {
            ActivityLogger.error(this, "BackgroundService", "Sync: Timeout", "60 saniye aşıldı")
        } catch (e: Exception) {
            ActivityLogger.error(
                this,
                "BackgroundService",
                "Sync exception",
                "${e.javaClass.simpleName}: ${e.message}"
            )
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
            Telephony.Sms.TYPE
        )

        val selection = if (sinceTimestamp > 0) {
            "${Telephony.Sms.DATE} > ?"
        } else null

        val selectionArgs = if (sinceTimestamp > 0) {
            arrayOf(sinceTimestamp.toString())
        } else null

        val sortOrder = "${Telephony.Sms.DATE} DESC LIMIT 500"

        try {
            ActivityLogger.info(
                this,
                "BackgroundService",
                "📖 SMS veritabanı okunuyor...",
                if (sinceTimestamp > 0) {
                    val dateFormat = SimpleDateFormat("HH:mm:ss dd/MM", Locale.getDefault())
                    "Filtre: ${dateFormat.format(Date(sinceTimestamp))} sonrası"
                } else {
                    "Filtre: TÜM SMS'ler (ilk sync)"
                }
            )

            contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)?.use { cursor ->
                val totalInCursor = cursor.count
                ActivityLogger.info(
                    this,
                    "BackgroundService",
                    "Cursor'da $totalInCursor SMS bulundu",
                    "Okunuyor..."
                )

                while (cursor.moveToNext()) {
                    val address = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.ADDRESS)) ?: continue
                    val body = cursor.getString(cursor.getColumnIndexOrThrow(Telephony.Sms.BODY)) ?: ""
                    val date = cursor.getLong(cursor.getColumnIndexOrThrow(Telephony.Sms.DATE))
                    val type = cursor.getInt(cursor.getColumnIndexOrThrow(Telephony.Sms.TYPE))

                    val smsType = when (type) {
                        Telephony.Sms.MESSAGE_TYPE_INBOX -> "received"
                        Telephony.Sms.MESSAGE_TYPE_SENT -> "sent"
                        else -> "received"
                    }

                    val contactName = getContactName(address)

                    messages.add(mapOf(
                        "phoneNumber" to address,
                        "contactName" to contactName,
                        "message" to body,
                        "type" to smsType,
                        "timestamp" to date
                    ))
                }

                ActivityLogger.success(
                    this,
                    "BackgroundService",
                    "✓ ${messages.size} SMS başarıyla okundu",
                    if (messages.isNotEmpty()) {
                        val oldest = messages.minOfOrNull { (it["timestamp"] as? Long) ?: 0L } ?: 0L
                        val newest = messages.maxOfOrNull { (it["timestamp"] as? Long) ?: 0L } ?: 0L
                        val dateFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
                        "Aralık: ${dateFormat.format(Date(oldest))} - ${dateFormat.format(Date(newest))}"
                    } else null
                )
            }

            // Toplam SMS sayısını güncelle
            val totalCount = getTotalSMSCount()
            prefs.edit().putInt("totalSms", totalCount).apply()

        } catch (e: Exception) {
            ActivityLogger.error(
                this,
                "BackgroundService",
                "SMS okuma hatası!",
                "${e.javaClass.simpleName}: ${e.message}"
            )
            android.util.Log.e("SMSPanel", "SMS okuma hatası", e)
        }

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
