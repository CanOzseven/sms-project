# 📋 Yapılacaklar Listesi

## ✅ TAMAMLANANLAR (Bu Session)

### 1. SMS Duplicate Sorunu Çözüldü ✅
**Problem:** Aynı kişiden birden fazla SMS duplicate olarak işaretleniyordu.

**Çözüm:**
- Android SMS'in kendi unique ID'si (`_ID` column) kullanılıyor
- Her SMS gerçekten benzersiz
- Backend: `deviceId + smsId` kombinasyonu ile unique index
- Android: Gönderilmiş SMS ID'lerini local'de tutuyor
- Backward compatible (eski hash sistemi de çalışıyor)

**Değişen Dosyalar:**
- `sms-panel/backend/models/SMS.js` - smsId field eklendi
- `sms-panel/backend/routes/device/sync.js` - smsId ile duplicate kontrolü
- `sms-panel/android/app/src/main/kotlin/com/smspanel/SMSBackgroundService.kt` - SMS ID gönderme ve tracking

### 2. Sistem Dokümantasyonu ✅
**Dosya:** `SISTEM-DOKUMANTASYONU.md`

**İçerik:**
- Tüm servisler (Backend API, MongoDB, Nginx)
- Tüm scriptler ve kullanımları
- Log görüntüleme komutları
- API endpoint listesi
- Hata ayıklama rehberi
- Teknoloji stack
- Güvenlik notları

---

## 🔴 KRİTİK - ÖNCELİKLİ YAPMALISIN

### 1. Backend API'yi Başlat
```bash
ssh root@158.220.101.218

# MongoDB başlat
systemctl start mongod
systemctl status mongod

# Backend başlat
cd /root/sms-project/sms-panel
pm2 start backend/server.js --name sms-panel
pm2 save

# Durum kontrol
pm2 status
pm2 logs sms-panel --lines 30
```

### 2. Aktivasyon Kodu Ekle
```bash
mongosh sms_panel

db.devices.insertOne({
  name: "Test Cihaz",
  activationCode: "F6A5C8B2",
  status: "pending",
  createdAt: new Date()
})

exit
```

### 3. Android APK Build ve Test
```bash
# Android Studio'da:
# 1. Build → Clean Project
# 2. Build → Rebuild Project
# 3. Build → Build APK(s)

# APK konumu:
# sms-panel/android/app/build/outputs/apk/release/app-release.apk
```

**Test Senaryosu:**
1. Uygulamayı sil, yeniden yükle
2. Aktivasyon yap: `F6A5C8B2`
3. **Aynı kişiden 5-10 farklı SMS gönder**
4. Panel'de hepsinin göründüğünü kontrol et
5. Yeni SMS geldiğinde anında göründüğünü kontrol et

---

## ⏳ YAPILACAKLAR (Sonraki Session)

### Frontend (Admin/User Panel)

#### 1. Auto-Refresh ⏰ **Yüksek Öncelik**
- SMS listesi 5 saniyede bir otomatik yenilensin
- Cihaz listesi 10 saniyede bir yenilensin
- Sayfalar arası geçişte refresh dursun, tekrar başlasın
- Loading indicator ekle (yenilerken göster)

**Teknik:**
```javascript
let refreshInterval = null;

function startAutoRefresh() {
  refreshInterval = setInterval(() => {
    loadSMS(); // veya aktif sayfanın load fonksiyonu
  }, 5000);
}

function stopAutoRefresh() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}

// Sayfa değiştiğinde:
stopAutoRefresh();
loadNewPage();
startAutoRefresh();
```

#### 2. Hamburger Menu Fix 🔧
**Problem:** Menu açılıp kapanıyor, sabit kalmalı.

**Çözüm:**
- Varsayılan olarak açık olsun (desktop'ta)
- Kullanıcı toggle butonuyla kapatabilsin
- State'i localStorage'da sakla
- Mobile'da default kapalı

#### 3. Oversized Add Buttons Fix 🎨
**Problem:** Ekleme butonları çok büyük görünüyor.

**Çözüm:**
- Button padding'i azalt: `padding: 8px 16px`
- Font size düşür: `font-size: 13px`
- Icon boyutunu düzelt
- Hover effect ekle

#### 4. Account Settings Page 👤
**Şu an boş, doldurulmalı:**
```
- Kullanıcı Adı (readonly)
- Şifre Değiştirme formu
- Email (opsiyonel)
- İki Faktörlü Kimlik Doğrulama (future)
- Oturum Geçmişi
- Aktif Cihazlar
```

#### 5. Activity Logs Redesign 📊
**Kaldır:**
- Ayrı "Aktivite Logları" sayfasını kaldır

**Ekle:**
- Dashboard'a minimal command-line style widget
- Son 10 aktivite göster
- Real-time güncelleme (WebSocket veya polling)
- Renklı log levels (INFO, WARNING, ERROR)
- Monospace font

**Tasarım:**
```
╔═══════════════════════════════════════╗
║ 📋 Son Aktiviteler                     ║
╠═══════════════════════════════════════╣
║ [16:45:23] ✓ SMS synced: 5 messages   ║
║ [16:45:20] ⚡ Device online: Test      ║
║ [16:44:15] ℹ User login: testuser     ║
║ [16:43:10] ⚠ High SMS volume detected ║
╚═══════════════════════════════════════╝
```

#### 6. Minimal UX - Widget Redesign 🎨
**Tüm widgetlara uygula:**
- Daha az padding
- İnce border (1px)
- Subtle shadow
- Hover effects
- Smooth transitions

**Örnek CSS:**
```css
.widget {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: box-shadow 0.2s;
}

.widget:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
```

### Backend

#### 1. Backend Logging İyileştirmesi 📝
**Ekle:**
- Structured logging (JSON format)
- Log levels (DEBUG, INFO, WARN, ERROR)
- Request/Response logging middleware
- Hata stacktrace'leri

**Örnek:**
```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

// Kullanım:
logger.info('SMS synced', { deviceId, count: 5 });
logger.error('Database error', { error: err.message, stack: err.stack });
```

#### 2. Real-time Updates (WebSocket) 🔌
**Şu anki durum:** Frontend 5 saniyede bir polling yapıyor.

**İdeal:** WebSocket ile real-time update.

```javascript
// Backend
const io = require('socket.io')(server);

io.on('connection', (socket) => {
  socket.on('subscribe', (deviceId) => {
    socket.join(`device:${deviceId}`);
  });
});

// Yeni SMS geldiğinde:
io.to(`device:${deviceId}`).emit('new-sms', smsData);

// Frontend
const socket = io();
socket.on('new-sms', (sms) => {
  addSmsToTable(sms);
  showNotification('Yeni SMS alındı');
});
```

### Android

#### 1. Better Error Messages in UI 💬
Şu anki durumda sadece Logcat'te görünüyor. UI'da da göster:
- Bağlantı hataları
- Sync hataları
- Aktivasyon hataları

#### 2. Retry Mechanism ♻️
Network hatalarında otomatik retry:
```kotlin
suspend fun syncWithRetry(maxRetries: Int = 3) {
  var lastError: Exception? = null

  repeat(maxRetries) { attempt ->
    try {
      syncAllSMS()
      return // Başarılı
    } catch (e: Exception) {
      lastError = e
      if (attempt < maxRetries - 1) {
        delay((attempt + 1) * 2000L) // Exponential backoff
      }
    }
  }

  // Tüm denemeler başarısız
  sendLogBroadcast("✗ Sync başarısız ($maxRetries deneme)")
}
```

### Temizlik

#### 1. Unused Services Cleanup 🧹
**Kontrol edilecek:**
- Kullanılmayan endpoint'ler
- Kullanılmayan model field'ları
- Dead code
- Console.log'lar (production'da kaldır)

---

## 🚀 Gelecek Geliştirmeler (Nice to Have)

### Güvenlik
- [ ] SSL/HTTPS
- [ ] Rate limiting
- [ ] IP whitelist
- [ ] 2FA (Two-Factor Authentication)
- [ ] Session management improvements

### Performans
- [ ] Database indexing optimization
- [ ] SMS pagination (şu an hepsini yüklüyor)
- [ ] Lazy loading
- [ ] Caching (Redis)

### Features
- [ ] SMS arama/filtreleme
- [ ] Export to CSV/Excel
- [ ] SMS templates
- [ ] Scheduled SMS sending
- [ ] SMS analytics (graphs)
- [ ] Multi-language support
- [ ] Dark/Light theme toggle

### DevOps
- [ ] Docker containerization
- [ ] CI/CD pipeline
- [ ] Automated backups
- [ ] Monitoring (Grafana/Prometheus)
- [ ] Automated tests (Jest, Mocha)

---

## 📞 Test Sonuçları (Doldurulacak)

### Backend Test
```
[ ] Backend başlatıldı ve çalışıyor
[ ] MongoDB bağlantısı OK
[ ] Admin login çalışıyor
[ ] Aktivasyon kodu veritabanına eklendi
[ ] PM2 logs görünüyor
```

### Android Test
```
[ ] APK build başarılı
[ ] Aktivasyon başarılı
[ ] Heartbeat atıyor (30 saniye)
[ ] İlk sync tamamlandı
[ ] Aynı kişiden birden fazla SMS sync oluyor
[ ] Yeni SMS geldiğinde anında panel'e düşüyor
[ ] Aktivite log'unda tüm işlemler görünüyor
```

### Frontend Test
```
[ ] Admin panele giriş yapılıyor
[ ] SMS listesi görünüyor
[ ] Cihaz listesi görünüyor
[ ] Yeni cihaz ekleniyor
[ ] SMS filtreleme çalışıyor
[ ] Responsive design OK (mobile/tablet/desktop)
```

---

## 📚 Kaynaklar

### Dökümantasyon
- **SISTEM-DOKUMANTASYONU.md** - Tüm servisler, scriptler, loglar
- **WORKFLOW.md** - Development workflow
- **DEV-GUIDE.md** - Development guide
- **MUSTERI-TALIMATLARI.md** - Customer instructions (Turkish)

### Kod Yapısı
```
sms-project/
├── sms-panel/
│   ├── backend/          # Node.js API
│   │   ├── models/       # Mongoose models
│   │   ├── routes/       # API endpoints
│   │   │   ├── admin/    # Admin routes
│   │   │   ├── user/     # User routes
│   │   │   └── device/   # Android device routes
│   │   ├── middleware/   # Auth middleware
│   │   └── server.js     # Main server
│   ├── frontend/         # HTML/JS panels
│   │   ├── admin-panel.html
│   │   └── user-panel.html
│   └── android/          # Kotlin Android app
│       └── app/src/main/kotlin/com/smspanel/
│           ├── MainActivity.kt
│           └── SMSBackgroundService.kt
└── SISTEM-DOKUMANTASYONU.md
```

---

*Son Güncelleme: 2025-12-07*
*Versiyon: 1.0*
