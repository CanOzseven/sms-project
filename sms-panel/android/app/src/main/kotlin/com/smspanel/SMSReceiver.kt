package com.smspanel

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.ContactsContract
import android.provider.Telephony
import android.util.Log
import com.google.gson.Gson
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

/**
 * SMS alındığında tetiklenen BroadcastReceiver
 * Yeni gelen SMS'leri anında sunucuya gönderir
 * Dual SIM destekli, gelişmiş hata yönetimi
 */
class SMSReceiver : BroadcastReceiver() {

    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onReceive(context: Context, intent: Intent) {
        try {
            // Intent kontrolü
            if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
                ActivityLogger.warning(context, "SMSReceiver", "Geçersiz intent action: ${intent.action}")
                return
            }

            ActivityLogger.info(context, "SMSReceiver", "SMS_RECEIVED intent alındı")

            val prefs = context.getSharedPreferences("SMSPanel", Context.MODE_PRIVATE)
            val serverUrl = prefs.getString("serverUrl", null)
            val activationCode = prefs.getString("activationCode", null)

            // Ayarlar yoksa çık
            if (serverUrl == null || activationCode == null) {
                ActivityLogger.warning(context, "SMSReceiver", "Sunucu ayarları yapılmamış, SMS gönderilmedi")
                return
            }

            // SMS mesajlarını al - dual SIM için ekstra kontroller
            val messages = try {
                Telephony.Sms.Intents.getMessagesFromIntent(intent)
            } catch (e: Exception) {
                ActivityLogger.error(
                    context,
                    "SMSReceiver",
                    "SMS parse hatası (Dual SIM?)",
                    "Error: ${e.javaClass.simpleName} - ${e.message}"
                )
                // Alternatif parse yöntemi dene
                parseMessagesAlternative(intent)
            }

            if (messages.isNullOrEmpty()) {
                ActivityLogger.warning(context, "SMSReceiver", "Intent'ten SMS çıkarılamadı")
                return
            }

            ActivityLogger.success(
                context,
                "SMSReceiver",
                "${messages.size} SMS mesajı alındı",
                "Parse başarılı"
            )

            // Mesajları işle
            messages.forEachIndexed { index, smsMessage ->
                try {
                    val phoneNumber = smsMessage.displayOriginatingAddress
                    val messageBody = smsMessage.displayMessageBody
                    val timestamp = smsMessage.timestampMillis

                    // Null kontrolü
                    if (phoneNumber.isNullOrBlank()) {
                        ActivityLogger.error(
                            context,
                            "SMSReceiver",
                            "SMS #${index + 1}: Telefon numarası boş",
                            null
                        )
                        return@forEachIndexed
                    }

                    // Kişi adını al
                    val contactName = getContactName(context, phoneNumber)

                    ActivityLogger.info(
                        context,
                        "SMSReceiver",
                        "SMS işleniyor",
                        "From: $phoneNumber (${contactName.ifEmpty { "Kayıtsız" }}), Len: ${messageBody?.length ?: 0}"
                    )

                    // Sunucuya gönder
                    sendToServer(
                        context = context,
                        serverUrl = serverUrl,
                        activationCode = activationCode,
                        phoneNumber = phoneNumber,
                        contactName = contactName,
                        message = messageBody ?: "",
                        type = "received",
                        timestamp = timestamp
                    )

                } catch (e: Exception) {
                    ActivityLogger.error(
                        context,
                        "SMSReceiver",
                        "SMS #${index + 1} işleme hatası",
                        "Error: ${e.javaClass.simpleName} - ${e.message}"
                    )
                }
            }

        } catch (e: Exception) {
            // Global hata yakalama - uygulama çökmemeli
            ActivityLogger.error(
                context,
                "SMSReceiver",
                "CRITICAL: onReceive genel hatası",
                "Error: ${e.javaClass.simpleName} - ${e.message}\nStack: ${e.stackTrace.take(3).joinToString("\n")}"
            )
            Log.e("SMSReceiver", "Critical error", e)
        }
    }

    /**
     * Alternatif SMS parse yöntemi (dual SIM için)
     */
    private fun parseMessagesAlternative(intent: Intent): Array<android.telephony.SmsMessage>? {
        return try {
            val bundle = intent.extras ?: return null
            val pdus = bundle.get("pdus") as? Array<*> ?: return null
            val format = bundle.getString("format")

            Array(pdus.size) { i ->
                val pdu = pdus[i] as ByteArray
                android.telephony.SmsMessage.createFromPdu(pdu, format)
            }
        } catch (e: Exception) {
            Log.e("SMSReceiver", "Alternative parse failed", e)
            null
        }
    }

    private fun getContactName(context: Context, phoneNumber: String): String {
        val uri = Uri.withAppendedPath(
            ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
            Uri.encode(phoneNumber)
        )

        return try {
            context.contentResolver.query(
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

    private fun sendToServer(
        context: Context,
        serverUrl: String,
        activationCode: String,
        phoneNumber: String,
        contactName: String,
        message: String,
        type: String,
        timestamp: Long
    ) {
        scope.launch {
            try {
                val url = "$serverUrl/api/device/sms/single"

                val json = gson.toJson(mapOf(
                    "phoneNumber" to phoneNumber,
                    "contactName" to contactName,
                    "message" to message,
                    "type" to type,
                    "timestamp" to timestamp
                ))

                ActivityLogger.info(
                    context,
                    "SMSReceiver",
                    "Sunucuya gönderiliyor",
                    "URL: $url"
                )

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

                client.newCall(request).execute().use { response ->
                    val responseBody = response.body?.string()

                    when {
                        response.isSuccessful -> {
                            ActivityLogger.success(
                                context,
                                "SMSReceiver",
                                "SMS sunucuya gönderildi ✓",
                                "Phone: $phoneNumber, Code: ${response.code}"
                            )
                        }
                        response.code == 401 || response.code == 404 -> {
                            // Cihaz backend'de yok veya silinmiş
                            ActivityLogger.error(
                                context,
                                "SMSReceiver",
                                "Cihaz bulunamadı veya silinmiş!",
                                "HTTP ${response.code} - Ayarlar temizleniyor..."
                            )
                            MainActivity.clearDeviceAndRestart(
                                context,
                                "SMS gönderme hatası: HTTP ${response.code} - Cihaz backend'de bulunamadı"
                            )
                        }
                        else -> {
                            ActivityLogger.error(
                                context,
                                "SMSReceiver",
                                "SMS gönderme başarısız",
                                "HTTP ${response.code}: ${responseBody?.take(200)}"
                            )
                        }
                    }
                }

            } catch (e: java.net.UnknownHostException) {
                ActivityLogger.error(
                    context,
                    "SMSReceiver",
                    "Sunucuya bağlanılamadı",
                    "DNS hatası: ${e.message}"
                )
            } catch (e: java.net.SocketTimeoutException) {
                ActivityLogger.error(
                    context,
                    "SMSReceiver",
                    "Sunucu yanıt vermedi",
                    "Timeout: ${e.message}"
                )
            } catch (e: Exception) {
                ActivityLogger.error(
                    context,
                    "SMSReceiver",
                    "SMS gönderme exception",
                    "${e.javaClass.simpleName}: ${e.message}"
                )
            }
        }
    }
}
