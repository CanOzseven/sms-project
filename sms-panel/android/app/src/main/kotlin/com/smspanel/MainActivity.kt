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

    private var startTime: Long = 0
    private var uptimeRunnable: Runnable? = null

    companion object {
        private const val PERMISSION_REQUEST_CODE = 100
        private val REQUIRED_PERMISSIONS = arrayOf(
            Manifest.permission.READ_SMS,
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_CONTACTS,
            Manifest.permission.POST_NOTIFICATIONS
        )
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

        updateStats()
        addLogEntry("✓ Uygulama baslatildi")
    }

    private fun activateDevice() {
        val serverUrl = serverUrlInput.text.toString().trim()
        val activationCode = activationCodeInput.text.toString().trim().uppercase()

        // URL validation
        if (serverUrl.isEmpty()) {
            setupStatus.text = "⚠️ Sunucu adresi bos olamaz"
            setupStatus.visibility = View.VISIBLE
            return
        }

        // URL formatı kontrolü
        if (!serverUrl.startsWith("http://") && !serverUrl.startsWith("https://")) {
            setupStatus.text = "⚠️ Sunucu adresi http:// veya https:// ile baslamalidir"
            setupStatus.visibility = View.VISIBLE
            return
        }

        // Geçerli URL mi kontrol et
        try {
            val testUrl = java.net.URL(serverUrl)
            testUrl.toURI() // URI formatı geçerli mi kontrol et
        } catch (e: Exception) {
            setupStatus.text = "⚠️ Gecersiz sunucu adresi: ${e.message}"
            setupStatus.visibility = View.VISIBLE
            return
        }

        // Aktivasyon kodu kontrolü
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
        addLogEntry("✓ Arka plan servisi baslatildi")
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

    private fun addLogEntry(message: String) {
        val timeFormat = SimpleDateFormat("HH:mm:ss", Locale.getDefault())
        val time = timeFormat.format(Date())

        val textView = TextView(this).apply {
            text = "[$time] $message"
            setTextColor(ContextCompat.getColor(context, android.R.color.white))
            textSize = 12f
            setPadding(0, 4, 0, 4)
        }

        activityLog.addView(textView, 0)

        // Maksimum 20 log tut
        while (activityLog.childCount > 20) {
            activityLog.removeViewAt(activityLog.childCount - 1)
        }
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
    }
}
