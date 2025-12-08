package com.smspanel

import android.Manifest
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.gson.Gson
import kotlinx.coroutines.*
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.*
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var prefs: SharedPreferences
    private val gson = Gson()
    private val handler = Handler(Looper.getMainLooper())

    // UI Elements - Setup Screen
    private lateinit var setupScreen: LinearLayout
    private lateinit var serverUrlInput: EditText
    private lateinit var activationCodeInput: EditText
    private lateinit var activateButton: Button
    private lateinit var setupStatus: TextView

    // UI Elements - Active Screen
    private lateinit var activeScreen: ScrollView
    private lateinit var deviceNameText: TextView
    private lateinit var statusIndicator: TextView
    private lateinit var uptimeText: TextView
    private lateinit var lastSyncText: TextView
    private lateinit var totalSmsText: TextView
    private lateinit var syncedSmsText: TextView
    private lateinit var activityLog: LinearLayout
    private lateinit var clearLogsButton: Button

    private var startTime: Long = 0
    private var uptimeRunnable: Runnable? = null
    private var logUpdateRunnable: Runnable? = null

    companion object {
        private const val PERMISSION_REQUEST_CODE = 100
        private val REQUIRED_PERMISSIONS = arrayOf(
            Manifest.permission.READ_SMS,
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.POST_NOTIFICATIONS
        )

        /**
         * Cihaz ayarlarını tamamen temizle ve setup ekranına dön
         * Backend'de cihaz silindiğinde veya bulunamadığında kullanılır
         */
        fun clearDeviceAndRestart(context: Context, reason: String = "Cihaz backend'de bulunamadı") {
            try {
                ActivityLogger.error(
                    context,
                    "System",
                    "HARD CLEAR: Cihaz ayarları temizleniyor",
                    reason
                )

                val prefs = context.getSharedPreferences("SMSPanel", Context.MODE_PRIVATE)
                prefs.edit().clear().apply()

                // Background service'i durdur
                val intent = Intent(context, SMSBackgroundService::class.java)
                context.stopService(intent)

                // MainActivity'yi yeniden başlat
                val restartIntent = Intent(context, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
                }
                context.startActivity(restartIntent)

                // Mevcut activity'yi kapat
                if (context is Activity) {
                    context.finish()
                }

            } catch (e: Exception) {
                android.util.Log.e("MainActivity", "Clear device error: ${e.message}")
            }
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        prefs = getSharedPreferences("SMSPanel", MODE_PRIVATE)

        initViews()
        checkPermissions()
    }

    private fun initViews() {
        // Setup Screen
        setupScreen = findViewById(R.id.setupScreen)
        serverUrlInput = findViewById(R.id.serverUrlInput)
        activationCodeInput = findViewById(R.id.activationCodeInput)
        activateButton = findViewById(R.id.activateButton)
        setupStatus = findViewById(R.id.setupStatus)

        // Active Screen
        activeScreen = findViewById(R.id.activeScreen)
        deviceNameText = findViewById(R.id.deviceNameText)
        statusIndicator = findViewById(R.id.statusIndicator)
        uptimeText = findViewById(R.id.uptimeText)
        lastSyncText = findViewById(R.id.lastSyncText)
        totalSmsText = findViewById(R.id.totalSmsText)
        syncedSmsText = findViewById(R.id.syncedSmsText)
        activityLog = findViewById(R.id.activityLog)

        activateButton.setOnClickListener { activateDevice() }
    }

    private fun checkPermissions() {
        val missingPermissions = REQUIRED_PERMISSIONS.filter {
            ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
        }

        if (missingPermissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(
                this,
                missingPermissions.toTypedArray(),
                PERMISSION_REQUEST_CODE
            )
        } else {
            onPermissionsGranted()
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode == PERMISSION_REQUEST_CODE) {
            if (grantResults.all { it == PackageManager.PERMISSION_GRANTED }) {
                onPermissionsGranted()
            } else {
                setupStatus.text = "⚠️ Izinler verilmedi. Uygulama calismak icin SMS ve Kisi izinlerine ihtiyac duyar."
                setupStatus.visibility = View.VISIBLE
            }
        }
    }

    private fun onPermissionsGranted() {
        val serverUrl = prefs.getString("serverUrl", null)
        val activationCode = prefs.getString("activationCode", null)

        if (serverUrl != null && activationCode != null) {
            showActiveScreen()
            startBackgroundService()
        } else {
            showSetupScreen()
        }
    }

    private fun showSetupScreen() {
        setupScreen.visibility = View.VISIBLE
        activeScreen.visibility = View.GONE
    }

    private fun showActiveScreen() {
        setupScreen.visibility = View.GONE
        activeScreen.visibility = View.VISIBLE

        val deviceName = prefs.getString("deviceName", "Bilinmeyen Cihaz")
        deviceNameText.text = "➜ Device: $deviceName"
        statusIndicator.text = "➜ Status: ACTIVE █"

        startTime = System.currentTimeMillis()
        startUptimeCounter()
        startLogUpdater()

        updateStats()
        ActivityLogger.success(this, "MainActivity", "Uygulama başlatıldı", null)
        refreshActivityLogs()
    }

    private fun activateDevice() {
        val serverUrl = serverUrlInput.text.toString().trim()
        val activationCode = activationCodeInput.text.toString().trim().uppercase()

        if (serverUrl.isEmpty()) {
            setupStatus.text = "⚠️ Sunucu adresi bos olamaz"
            setupStatus.visibility = View.VISIBLE
            return
        }

        if (activationCode.isEmpty() || activationCode.length != 8) {
            setupStatus.text = "⚠️ Aktivasyon kodu 8 karakter olmalidir"
            setupStatus.visibility = View.VISIBLE
            return
        }

        activateButton.isEnabled = false
        setupStatus.text = "⏳ Aktivasyon yapiliyor..."
        setupStatus.visibility = View.VISIBLE

        val url = serverUrl.removeSuffix("/") + "/api/device/activate"
        val model = "${Build.MANUFACTURER} ${Build.MODEL}"
        val androidId = android.provider.Settings.Secure.getString(
            contentResolver,
            android.provider.Settings.Secure.ANDROID_ID
        )

        val json = gson.toJson(mapOf("model" to model, "androidId" to androidId))

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

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                runOnUiThread {
                    activateButton.isEnabled = true
                    setupStatus.text = "❌ Baglanti hatasi: ${e.message}"
                }
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string()
                runOnUiThread {
                    activateButton.isEnabled = true

                    if (response.isSuccessful) {
                        try {
                            val result = gson.fromJson(body, Map::class.java)
                            val device = result["device"] as? Map<*, *>
                            val deviceName = device?.get("name") as? String ?: "Bilinmeyen"

                            // Kaydet
                            prefs.edit()
                                .putString("serverUrl", serverUrl.removeSuffix("/"))
                                .putString("activationCode", activationCode)
                                .putString("deviceName", deviceName)
                                .apply()

                            setupStatus.text = "✅ Aktivasyon basarili!"

                            // Aktif ekrana gec
                            handler.postDelayed({
                                showActiveScreen()
                                startBackgroundService()
                            }, 1000)
                        } catch (e: Exception) {
                            setupStatus.text = "❌ Yanit isleme hatasi"
                        }
                    } else {
                        try {
                            val error = gson.fromJson(body, Map::class.java)
                            setupStatus.text = "❌ ${error["message"] ?: "Bilinmeyen hata"}"
                        } catch (e: Exception) {
                            setupStatus.text = "❌ Aktivasyon basarisiz (${response.code})"
                        }
                    }
                }
            }
        })
    }

    private fun startBackgroundService() {
        val intent = Intent(this, SMSBackgroundService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        ActivityLogger.success(this, "MainActivity", "Arka plan servisi başlatıldı", null)
    }

    private fun startUptimeCounter() {
        uptimeRunnable = object : Runnable {
            override fun run() {
                val elapsed = System.currentTimeMillis() - startTime
                val seconds = (elapsed / 1000) % 60
                val minutes = (elapsed / (1000 * 60)) % 60
                val hours = (elapsed / (1000 * 60 * 60))

                uptimeText.text = "⏱ Uptime: ${String.format("%02d:%02d:%02d", hours, minutes, seconds)}"
                handler.postDelayed(this, 1000)
            }
        }
        handler.post(uptimeRunnable!!)
    }

    private fun updateStats() {
        val totalSms = prefs.getInt("totalSms", 0)
        val syncedSms = prefs.getInt("syncedSms", 0)
        val lastSync = prefs.getLong("lastSync", 0)

        totalSmsText.text = "$totalSms"
        syncedSmsText.text = "$syncedSms"

        if (lastSync > 0) {
            val dateFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
            lastSyncText.text = "⏱ Son sync: ${dateFormat.format(Date(lastSync))}"
        }
    }

    /**
     * Activity log'ları her 3 saniyede bir güncelle
     */
    private fun startLogUpdater() {
        logUpdateRunnable = object : Runnable {
            override fun run() {
                refreshActivityLogs()
                handler.postDelayed(this, 3000) // Her 3 saniye
            }
        }
        handler.post(logUpdateRunnable!!)
    }

    /**
     * Merkezi log sisteminden logları çek ve göster
     */
    private fun refreshActivityLogs() {
        try {
            val logs = ActivityLogger.getAllLogs(this)
            activityLog.removeAllViews()

            if (logs.isEmpty()) {
                val textView = TextView(this).apply {
                    text = "Henüz log kaydı yok"
                    setTextColor(ContextCompat.getColor(context, android.R.color.darker_gray))
                    textSize = 12f
                    setPadding(8, 8, 8, 8)
                }
                activityLog.addView(textView)
                return
            }

            // Son 30 logu göster
            logs.take(30).forEach { log ->
                val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
                val time = try {
                    val fullFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.getDefault())
                    val date = fullFormat.parse(log.timestamp)
                    timeFormat.format(date ?: Date())
                } catch (e: Exception) {
                    "??:??:??"
                }

                // Level'e göre renk ve emoji
                val (emoji, color) = when (log.level) {
                    "SUCCESS" -> "✓" to android.R.color.holo_green_light
                    "ERROR" -> "✗" to android.R.color.holo_red_light
                    "WARNING" -> "⚠" to android.R.color.holo_orange_light
                    else -> "•" to android.R.color.white
                }

                val textView = TextView(this).apply {
                    val displayText = buildString {
                        append("[$time] $emoji ")
                        append("[${log.component}] ")
                        append(log.message)
                        if (!log.details.isNullOrBlank()) {
                            append("\n    → ${log.details}")
                        }
                    }
                    text = displayText
                    setTextColor(ContextCompat.getColor(context, color))
                    textSize = 11f
                    setPadding(4, 4, 4, 4)
                    setTypeface(null, android.graphics.Typeface.NORMAL)
                }

                activityLog.addView(textView)
            }

        } catch (e: Exception) {
            android.util.Log.e("MainActivity", "Log refresh hatası: ${e.message}")
        }
    }

    @Deprecated("Eski log sistemi, artık ActivityLogger kullanılıyor")
    private fun addLogEntry(message: String) {
        ActivityLogger.info(this, "MainActivity", message, null)
    }

    override fun onResume() {
        super.onResume()
        if (activeScreen.visibility == View.VISIBLE) {
            updateStats()
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        uptimeRunnable?.let { handler.removeCallbacks(it) }
        logUpdateRunnable?.let { handler.removeCallbacks(it) }
    }
}
