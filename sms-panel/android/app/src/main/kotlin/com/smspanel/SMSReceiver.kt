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
 */
class SMSReceiver : BroadcastReceiver() {

    private val gson = Gson()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            return
        }

        val prefs = context.getSharedPreferences("SMSPanel", Context.MODE_PRIVATE)
        val serverUrl = prefs.getString("serverUrl", null)
        val activationCode = prefs.getString("activationCode", null)

        // Ayarlar yoksa çık
        if (serverUrl == null || activationCode == null) {
            Log.w("SMSReceiver", "Sunucu ayarları yapılmamış")
            return
        }

        // SMS mesajlarını al
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)

        if (messages.isNullOrEmpty()) {
            return
        }

        // Mesajları işle
        messages.forEach { smsMessage ->
            val phoneNumber = smsMessage.displayOriginatingAddress ?: return@forEach
            val messageBody = smsMessage.displayMessageBody ?: ""
            val timestamp = smsMessage.timestampMillis

            // Kişi adını al
            val contactName = getContactName(context, phoneNumber)

            Log.d("SMSReceiver", "Yeni SMS: $phoneNumber - ${messageBody.take(50)}...")

            // Sunucuya gönder
            sendToServer(
                serverUrl = serverUrl,
                activationCode = activationCode,
                phoneNumber = phoneNumber,
                contactName = contactName,
                message = messageBody,
                type = "received",
                timestamp = timestamp
            )
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
        serverUrl: String,
        activationCode: String,
        phoneNumber: String,
        contactName: String,
        message: String,
        type: String,
        timestamp: Long
    ) {
        scope.launch {
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
                        Log.d("SMSReceiver", "SMS sunucuya gönderildi: $phoneNumber")
                    } else {
                        Log.e("SMSReceiver", "SMS gönderme hatası: ${response.code}")
                    }
                }
            } catch (e: Exception) {
                Log.e("SMSReceiver", "SMS gönderme exception: ${e.message}")
            }
        }
    }
}
