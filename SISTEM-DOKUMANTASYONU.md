# 📚 SMS Panel Sistem Dokümantasyonu

## 🎯 Genel Bakış

SMS Panel projesi 3 ana bileşenden oluşur:
1. **Backend API** (Node.js + Express + MongoDB)
2. **Frontend** (Admin Panel + User Panel - HTML/JS)
3. **Android App** (Kotlin)

---

## 🚀 Servisler ve Konumları

### 1. Backend API Servisi

**Konum:** `/root/sms-project/sms-panel/backend/`
**Port:** 3000
**PM2 İsmi:** `sms-panel`

**Başlatma:**
```bash
cd /root/sms-project/sms-panel
pm2 start backend/server.js --name sms-panel
pm2 save
```

**Durdurma:**
```bash
pm2 stop sms-panel
```

**Yeniden Başlatma:**
```bash
pm2 restart sms-panel
```

**Logları Görüntüleme:**
```bash
# Canlı loglar
pm2 logs sms-panel

# Son 50 satır
pm2 logs sms-panel --lines 50 --nostream

# Sadece hata logları
pm2 logs sms-panel --err

# Logları temizle
pm2 flush sms-panel
```

---

### 2. MongoDB Servisi

**Veritabanı:** `sms_panel`
**Port:** 27017 (varsayılan)

**Başlatma:**
```bash
systemctl start mongod
```

**Durdurma:**
```bash
systemctl stop mongod
```

**Durum Kontrol:**
```bash
systemctl status mongod
```

**MongoDB Shell:**
```bash
mongosh sms_panel
```

**Veritabanı Sorguları:**
```javascript
// Tüm koleksiyonları göster
show collections

// Cihazları listele
db.devices.find().pretty()

// Kullanıcıları listele
db.users.find().pretty()

// SMS sayısı
db.sms.countDocuments()

// Son 10 SMS
db.sms.find().sort({timestamp: -1}).limit(10)

// Bir cihazın SMS'leri
db.sms.find({deviceId: ObjectId("...")}).count()
```

---

### 3. Nginx Web Server

**Port:** 80 (HTTP)
**Konfig:** `/etc/nginx/sites-available/sms-panel`

**Başlatma:**
```bash
systemctl start nginx
```

**Yeniden Yükle:**
```bash
systemctl reload nginx
```

**Durum:**
```bash
systemctl status nginx
```

**Test Et:**
```bash
nginx -t
```

**Loglar:**
```bash
# Access logs
tail -f /var/log/nginx/access.log

# Error logs
tail -f /var/log/nginx/error.log
```

---

## 📜 Scriptler ve Kullanımları

### Backend Scriptleri

**1. `update.sh` - Production Update**
```bash
cd /root/sms-project/sms-panel
./update.sh
```
- Git pull yapar
- Backend'i restart eder
- Nginx'i reload eder

**2. `dev-start.sh` - Development Backend**
```bash
cd /home/user/sms-project/sms-panel
./dev-start.sh
```
- .env oluşturur
- MongoDB kontrol eder
- Backend'i development modda başlatır

**3. `dev-frontend.sh` - Development Frontend**
```bash
cd /home/user/sms-project/sms-panel
./dev-frontend.sh
```
- API_URL'i localhost:3000'e çevirir
- Python HTTP server başlatır (port 8080)
- Ctrl+C ile çıkınca API_URL'i geri döndürür

---

### Android Scriptleri

**1. `build-apk.sh` - APK Build**
```bash
cd /home/user/sms-project/sms-panel
./build-apk.sh
```
- Gradle clean + assembleRelease
- APK'yı `release/` klasörüne kopyalar

---

## 📊 Logları İzleme

### Backend Logları

**PM2 Logs (Önerilen):**
```bash
pm2 logs sms-panel --lines 100
```

**Console.log çıktıları:**
- SMS sync işlemleri
- Heartbeat durumu
- Aktivasyon istekleri
- Hatalar

**Log Formatı:**
```
2025-12-07 16:03:36 - POST /api/device/sms
SMS ID 12345 veritabanında mevcut, atlanıyor
✓ 5 SMS senkronize edildi, 495 duplicate (Toplam: 5)
```

---

### Android Logları

**Android Studio Logcat:**
```
Filter: tag:SMSPanel
```

**Önemli Loglar:**
```
========================================
AKTİVASYON BAŞLADI
Server URL: http://158.220.101.218
========================================

>>> HEARTBEAT <<<
✓ Heartbeat başarılı (234ms)

>>> SMS SYNC <<<
Cihazdan okunan SMS sayısı: 819
📤 819 SMS senkronize ediliyor...
✓ 5 SMS senkronize edildi, 814 duplicate
```

---

### Sistem Logları

**Nginx Logs:**
```bash
# Tüm HTTP istekleri
tail -f /var/log/nginx/access.log | grep "/api/"

# Sadece hatalar
tail -f /var/log/nginx/error.log
```

**MongoDB Logs:**
```bash
tail -f /var/log/mongodb/mongod.log
```

**Sistem Logs:**
```bash
journalctl -u mongod -f
journalctl -u nginx -f
```

---

## 🔍 Servis Durumlarını Kontrol

### Hızlı Kontrol Scripti

```bash
cat << 'EOF' > /tmp/check-all.sh
#!/bin/bash
echo "==================================="
echo "SMS PANEL SİSTEM DURUMU"
echo "==================================="
echo ""

echo "📡 Backend (PM2):"
pm2 status | grep sms-panel

echo ""
echo "🗄️  MongoDB:"
systemctl is-active mongod

echo ""
echo "🌐 Nginx:"
systemctl is-active nginx

echo ""
echo "📊 Backend Port (3000):"
netstat -tulpn | grep :3000

echo ""
echo "📱 SMS Sayısı (MongoDB):"
mongosh sms_panel --quiet --eval "db.sms.countDocuments()"

echo ""
echo "🖥️  Cihaz Sayısı:"
mongosh sms_panel --quiet --eval "db.devices.countDocuments()"

echo "==================================="
EOF

chmod +x /tmp/check-all.sh
/tmp/check-all.sh
```

---

## 🔧 Endpoint Listesi

### Backend API Endpoints

**Admin Endpoints:**
```
POST   /api/admin/login          - Admin girişi
GET    /api/admin/users          - Kullanıcı listesi
POST   /api/admin/users          - Kullanıcı oluştur
PUT    /api/admin/users/:id      - Kullanıcı güncelle
DELETE /api/admin/users/:id      - Kullanıcı sil
GET    /api/admin/devices        - Cihaz listesi
POST   /api/admin/devices        - Cihaz oluştur
DELETE /api/admin/devices/:id    - Cihaz sil
GET    /api/admin/sms            - Tüm SMS'ler
GET    /api/admin/permissions    - Yetki listesi
POST   /api/admin/permissions    - Yetki ver
DELETE /api/admin/permissions/:id - Yetki kaldır
```

**User Endpoints:**
```
POST   /api/user/login           - Kullanıcı girişi
GET    /api/user/devices         - Yetkili cihazlar
GET    /api/user/sms             - Yetkili cihazların SMS'leri
GET    /api/user/profile         - Profil bilgileri
PUT    /api/user/profile         - Profil güncelle
```

**Device Endpoints (Android):**
```
POST   /api/device/activate      - Cihaz aktivasyonu
POST   /api/device/heartbeat     - Heartbeat (30 saniye)
POST   /api/device/sms           - SMS batch sync (5 saniye)
POST   /api/device/sms/single    - Tekil SMS gönder
GET    /api/device/sms/last-sync - Son sync zamanı
```

**Health Check:**
```
GET    /health                   - Sunucu durumu
GET    /api                      - API bilgileri
```

---

## 🐛 Hata Ayıklama

### Backend Çalışmıyor

```bash
# PM2 status kontrol
pm2 status

# PM2 loglarına bak
pm2 logs sms-panel --lines 50

# MongoDB çalışıyor mu?
systemctl status mongod

# Port kullanımda mı?
netstat -tulpn | grep :3000

# Servisi yeniden başlat
pm2 restart sms-panel
```

### Android Bağlanamıyor

```bash
# Backend canlı mı?
curl http://158.220.101.218/health

# Firewall açık mı?
iptables -L -n | grep 3000

# Nginx çalışıyor mu?
systemctl status nginx

# Nginx proxy doğru mu?
cat /etc/nginx/sites-available/sms-panel
```

### SMS Sync Çalışmıyor

```bash
# Backend loglarına bak
pm2 logs sms-panel | grep "SMS SYNC"

# MongoDB'de SMS var mı?
mongosh sms_panel --eval "db.sms.countDocuments()"

# Cihaz online mı?
mongosh sms_panel --eval "db.devices.find({status: 'online'})"
```

---

## 📦 Kullanılan Teknolojiler

### Backend
- Node.js v18+
- Express.js 4.x
- MongoDB 6.x
- Mongoose 7.x
- JWT Authentication
- PM2 Process Manager

### Frontend
- Vanilla JavaScript
- HTML5 + CSS3
- Fetch API
- LocalStorage

### Android
- Kotlin
- OkHttp
- Gson
- Android SMS API
- Foreground Service

---

## 📝 Kalan İşler (TODO)

### Backend
- [ ] Real-time WebSocket desteği (5 saniye yerine anında update)
- [ ] Rate limiting
- [ ] API documentation (Swagger)
- [ ] Unit tests
- [ ] Better error handling

### Frontend
- [ ] Admin panel hamburger menu fix
- [ ] Oversized button fix
- [ ] Account settings completion
- [ ] Auto-refresh (5 seconds)
- [ ] Command-line style activity logs widget
- [ ] Minimal UX redesign
- [ ] Remove separate Activity Logs page

### Android
- [ ] Better error messages in UI
- [ ] Retry mechanism for failed syncs
- [ ] Local SMS cache
- [ ] Export logs feature

### DevOps
- [ ] SSL/HTTPS setup
- [ ] Automated backups
- [ ] Monitoring (Grafana/Prometheus)
- [ ] CI/CD pipeline

---

## 🔐 Güvenlik Notları

**Varsayılan Admin Hesabı:**
```
Username: admin
Password: admin123
```
⚠️ **ÖNEMLİ:** Production'da şifreyi mutlaka değiştirin!

**Şifre Değiştirme:**
```javascript
// MongoDB'de
mongosh sms_panel

const bcrypt = require('bcryptjs');
const newPassword = bcrypt.hashSync('yeni_sifre', 10);

db.users.updateOne(
  { username: 'admin' },
  { $set: { password: newPassword } }
);
```

---

## 📞 Yardım ve Destek

**Sorun giderme adımları:**
1. Logları kontrol et (pm2 logs, nginx logs)
2. Servisleri yeniden başlat
3. MongoDB bağlantısını kontrol et
4. Firewall kurallarını kontrol et
5. Disk alanı kontrol et (`df -h`)

**Son Güncellemeler:**
```bash
cd /root/sms-project
git log --oneline -10
```

---

*Dokümantasyon Versiyonu: 1.0*
*Son Güncelleme: 2025-12-07*
