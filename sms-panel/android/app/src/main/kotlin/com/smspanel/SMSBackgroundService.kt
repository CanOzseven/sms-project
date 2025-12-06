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
        private const val HEARTBEAT_INTERVAL = 5 * 60 * 1000L // 5 dakika
        private const val SYNC_INTERVAL = 15 * 60 * 1000L // 15 dakika
    }

    override fun onCreate() {
        super.onCreate()
        prefs = getSharedPreferences("SMSPanel", MODE_PRIVATE)
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification())

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
                if (response.isSuccessful) {
                    android.util.Log.d("SMSPanel", "Heartbeat gönderildi")
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("SMSPanel", "Heartbeat hatası: ${e.message}")
        }
    }

    private suspend fun syncAllSMS() {
        val serverUrl = prefs.getString("serverUrl", null) ?: return
        val activationCode = prefs.getString("activationCode", null) ?: return

        // Son sync zamanını al
        val lastSyncTime = prefs.getLong("lastSyncTimestamp", 0)

        // SMS'leri oku
        val messages = readSMSMessages(lastSyncTime)

        if (messages.isEmpty()) {
            android.util.Log.d("SMSPanel", "Yeni SMS yok")
            return
        }

        android.util.Log.d("SMSPanel", "${messages.size} SMS senkronize edilecek")

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

        try {
            client.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val body = response.body?.string()
                    val result = gson.fromJson(body, Map::class.java)
                    val synced = (result["synced"] as? Double)?.toInt() ?: 0

                    // İstatistikleri güncelle
                    val totalSynced = prefs.getInt("syncedSms", 0) + synced
                    prefs.edit()
                        .putInt("syncedSms", totalSynced)
                        .putLong("lastSync", System.currentTimeMillis())
                        .putLong("lastSyncTimestamp", System.currentTimeMillis())
                        .apply()

                    android.util.Log.d("SMSPanel", "$synced SMS senkronize edildi")
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("SMSPanel", "SMS sync hatası: ${e.message}")
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
            contentResolver.query(uri, projection, selection, selectionArgs, sortOrder)?.use { cursor ->
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
            }

            // Toplam SMS sayısını güncelle
            val totalCount = getTotalSMSCount()
            prefs.edit().putInt("totalSms", totalCount).apply()

        } catch (e: Exception) {
            android.util.Log.e("SMSPanel", "SMS okuma hatası: ${e.message}")
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
