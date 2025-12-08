package com.smspanel

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import java.text.SimpleDateFormat
import java.util.*

/**
 * Merkezi aktivite loglama sistemi
 * Tüm bileşenlerden gelen logları SharedPreferences'da tutar
 */
object ActivityLogger {

    private const val PREFS_NAME = "SMSPanel"
    private const val KEY_ACTIVITY_LOGS = "activity_logs"
    private const val MAX_LOGS = 50

    private val gson = Gson()
    private val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.getDefault())

    data class LogEntry(
        val timestamp: String,
        val level: String, // INFO, SUCCESS, WARNING, ERROR
        val component: String, // MainActivity, SMSReceiver, BackgroundService
        val message: String,
        val details: String? = null
    )

    /**
     * Log ekle
     */
    fun log(
        context: Context,
        level: String,
        component: String,
        message: String,
        details: String? = null
    ) {
        try {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val logs = getLogs(prefs).toMutableList()

            val entry = LogEntry(
                timestamp = dateFormat.format(Date()),
                level = level,
                component = component,
                message = message,
                details = details
            )

            // En yeni logu başa ekle
            logs.add(0, entry)

            // Maksimum log sayısını aşma
            if (logs.size > MAX_LOGS) {
                logs.subList(MAX_LOGS, logs.size).clear()
            }

            // Kaydet
            val json = gson.toJson(logs)
            prefs.edit().putString(KEY_ACTIVITY_LOGS, json).apply()

            // Android logcat'e de yaz
            android.util.Log.d("ActivityLogger", "[$level][$component] $message ${details ?: ""}")

        } catch (e: Exception) {
            android.util.Log.e("ActivityLogger", "Log kaydetme hatası: ${e.message}")
        }
    }

    /**
     * Shortcut metodlar
     */
    fun info(context: Context, component: String, message: String, details: String? = null) {
        log(context, "INFO", component, message, details)
    }

    fun success(context: Context, component: String, message: String, details: String? = null) {
        log(context, "SUCCESS", component, message, details)
    }

    fun warning(context: Context, component: String, message: String, details: String? = null) {
        log(context, "WARNING", component, message, details)
    }

    fun error(context: Context, component: String, message: String, details: String? = null) {
        log(context, "ERROR", component, message, details)
    }

    /**
     * Tüm logları getir
     */
    fun getAllLogs(context: Context): List<LogEntry> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        return getLogs(prefs)
    }

    /**
     * Logları temizle
     */
    fun clearLogs(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().remove(KEY_ACTIVITY_LOGS).apply()
    }

    private fun getLogs(prefs: SharedPreferences): List<LogEntry> {
        val json = prefs.getString(KEY_ACTIVITY_LOGS, null) ?: return emptyList()
        return try {
            val type = object : TypeToken<List<LogEntry>>() {}.type
            gson.fromJson(json, type)
        } catch (e: Exception) {
            emptyList()
        }
    }
}
