package com.smspanel

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

/**
 * Cihaz yeniden başlatıldığında servisi otomatik başlatan receiver
 */
class BootReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON") {

            Log.d("SMSPanel", "Boot completed, checking configuration...")

            val prefs = context.getSharedPreferences("SMSPanel", Context.MODE_PRIVATE)
            val serverUrl = prefs.getString("serverUrl", null)
            val activationCode = prefs.getString("activationCode", null)

            // Ayarlar varsa servisi başlat
            if (serverUrl != null && activationCode != null) {
                Log.d("SMSPanel", "Configuration found, starting service...")

                val serviceIntent = Intent(context, SMSBackgroundService::class.java)

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    context.startForegroundService(serviceIntent)
                } else {
                    context.startService(serviceIntent)
                }
            } else {
                Log.d("SMSPanel", "No configuration found, service not started")
            }
        }
    }
}
