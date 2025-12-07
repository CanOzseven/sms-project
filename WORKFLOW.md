# 🚀 SMS Panel - Hızlı Başvuru Kılavuzu

## 📱 ANDROID UYGULAMASI

### Konum
```
sms-panel/android/
```

### Android'de Değişiklik Gerekli Mi?

**HAYIR!** ✅ Backend değişikliklerinden sonra Android uygulamasını güncellemenize gerek yok çünkü:

- Android uygulama API URL'i kullanıcıdan alıyor (setup ekranında)
- Backend API endpoint'leri değişmedi
- Sadece frontend'te URL düzeltmesi yapıldı

### Android APK Build (Gerekirse)

```bash
cd sms-panel/android

# Gradle ile build
./gradlew assembleRelease

# APK konumu:
# app/build/outputs/apk/release/app-release.apk
```

### Android Uygulama Kullanımı

1. **APK'yı yükle** (ilk kurulum veya güncelleme)
2. **İzinleri ver** (SMS, Kişiler, Bildirimler)
3. **Aktivasyon ekranı:**
   - Server URL: `http://158.220.101.218` (VPS IP)
   - Aktivasyon Kodu: Admin panelden oluşturulan 8 haneli kod
4. **Aktif et** - Otomatik SMS senkronizasyonu başlar

---

## 💻 GELİŞTİRME ORTAMI (LOCAL TEST)

### Backend Başlatma

```bash
cd sms-panel
./dev-start.sh
```

**Ne yapar:**
- MongoDB başlatır (varsa)
- .env dosyası oluşturur (yoksa)
- npm install yapar (gerekirse)
- Backend'i development modunda başlatır (`http://localhost:3000`)

### Frontend Başlatma

**YENİ TERMINAL AÇ:**

```bash
cd sms-panel
./dev-frontend.sh
```

**Ne yapar:**
- API_URL'i otomatik `http://localhost:3000/api` yapar
- Python http.server başlatır (`http://localhost:8080`)
- Ctrl+C ile çıkınca API_URL'i `/api` (production) geri döndürür

**Erişim:**
- Admin: http://localhost:8080/admin-panel.html
- User: http://localhost:8080/user-panel.html
- Backend: http://localhost:3000/api

---

## 🚀 PRODUCTION (VPS) İŞLEMLERİ

### VPS'e Bağlanma

```bash
ssh root@158.220.101.218
# Şifre: Cemocan01
```

### İlk Kurulum (Sadece Bir Kez)

```bash
cd /opt
bash <(curl -s https://raw.githubusercontent.com/CanOzseven/sms-project/main/sms-panel/install.sh)
```

### Güncelleme (Her Deploy'da)

```bash
# Yöntem 1: Otomatik (Update Script)
cd /opt/sms-panel
bash sms-panel/update.sh

# Yöntem 2: Manuel
cd /opt/sms-panel
git pull origin branch-adi
pm2 restart sms-panel-backend
systemctl reload nginx
pm2 status
```

### Durum Kontrolleri

```bash
# Backend durumu
pm2 status
pm2 logs sms-panel-backend --lines 20

# MongoDB durumu
systemctl status mongod

# Nginx durumu
systemctl status nginx
nginx -t

# Port kontrolü
netstat -tulpn | grep 3000
```

---

## 👤 KULLANICI YÖNETİMİ

### Admin Şifresi Değiştirme

**UI'dan:**
1. http://158.220.101.218/admin-panel.html
2. Login: admin@sms-panel.com / admin123
3. Profil ikonu → "Hesap Ayarları"

**MongoDB'den:**
```bash
ssh root@158.220.101.218
node -e "console.log(require('bcryptjs').hashSync('YeniSifre123', 10))"
# Çıkan hash'i kopyala

mongosh sms-panel
use sms-panel
db.users.updateOne(
  { email: "admin@sms-panel.com" },
  { $set: { password: "HASH_BURAYA" } }
)
```

### Yeni Kullanıcı Ekleme

**Admin Panel'den:**
1. Sol menü → "Kullanıcılar"
2. "+ Yeni Kullanıcı"
3. Form doldur → Kaydet

**Alanlar:**
- Ad Soyad
- Email
- Şifre
- Rol: User/Admin
- Durum: Aktif/Pasif
- Yetkili Cihazlar: Checkbox'lardan seç

---

## 📲 CİHAZ YÖNETİMİ

### Yeni Cihaz Ekleme

**Admin Panel'den:**
1. Sol menü → "Cihazlar"
2. "+ Yeni Cihaz"
3. Cihaz adı gir → Kaydet
4. **Aktivasyon kodunu kopyala** (8 haneli)

**Android'de:**
1. APK'yı cihaza yükle
2. Server URL: `http://158.220.101.218`
3. Aktivasyon kodu: Yukarıda kopyaladığın kod
4. Aktif et

### Kullanıcıya Cihaz Yetkisi Verme

**Yöntem 1: Kullanıcı eklerken**
- Kullanıcı formunda "Yetkili Cihazlar" checkbox'larını işaretle

**Yöntem 2: Yetkiler sayfasından**
1. Sol menü → "Yetkiler"
2. "+ Yetki Ver"
3. Kullanıcı ve cihaz seç → Kaydet

---

## 🔄 GELİŞTİRME İŞ AKIŞI

### 1️⃣ Local'de Geliştir ve Test Et

```bash
# Terminal 1: Backend
cd sms-panel
./dev-start.sh

# Terminal 2: Frontend
cd sms-panel
./dev-frontend.sh

# Tarayıcı: http://localhost:8080/admin-panel.html
```

### 2️⃣ Değişiklikleri Commit Et

```bash
git add .
git commit -m "feat: Yeni özellik açıklaması"
git push origin branch-adi
```

### 3️⃣ Production'a Deploy Et

```bash
# VPS'e bağlan
ssh root@158.220.101.218

# Güncelle
cd /opt/sms-panel
git pull origin branch-adi
pm2 restart sms-panel-backend
systemctl reload nginx

# Kontrol
pm2 status
pm2 logs sms-panel-backend --lines 20
```

### 4️⃣ Test Et

```bash
# Tarayıcıda aç (Ctrl+F5 ile cache temizle)
http://158.220.101.218/admin-panel.html
http://158.220.101.218/user-panel.html
```

---

## 🐛 HATA AYIKLAMA

### "Failed to fetch" / Sunucuya bağlanılamıyor

```bash
# Backend çalışıyor mu?
pm2 status
pm2 logs sms-panel-backend

# MongoDB çalışıyor mu?
systemctl status mongod
systemctl start mongod  # Başlat

# Port dinleniyor mu?
netstat -tulpn | grep 3000

# Nginx proxy çalışıyor mu?
nginx -t
systemctl reload nginx
```

### Login Çalışmıyor

```bash
# Backend logları
pm2 logs sms-panel-backend --lines 50

# MongoDB'de user var mı?
mongosh sms-panel
use sms-panel
db.users.find({ email: "admin@sms-panel.com" })

# User status active mi?
db.users.updateOne(
  { email: "admin@sms-panel.com" },
  { $set: { status: "active" } }
)
```

### PM2 Servisi Başlamıyor

```bash
# PM2 yeniden başlat
pm2 delete all
cd /opt/sms-panel/sms-panel/backend
pm2 start server.js --name sms-panel-backend
pm2 save
pm2 status
```

### MongoDB Başlamıyor

```bash
# Durum kontrol
systemctl status mongod

# Başlat
systemctl start mongod

# Otomatik başlatma aktif et
systemctl enable mongod

# Logları kontrol et
tail -f /var/log/mongodb/mongod.log
```

---

## 📊 MONITORING

### Canlı Log Takibi

```bash
# Backend logs (canlı)
pm2 logs sms-panel-backend --lines 0

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log

# MongoDB logs
tail -f /var/log/mongodb/mongod.log
```

### Kaynak Kullanımı

```bash
# PM2 monitoring
pm2 monit

# Sistem kaynakları
htop
# veya
top

# Disk kullanımı
df -h

# Bellek kullanımı
free -h
```

---

## 🔐 GÜVENLİK

### Önemli Şifreler

```bash
# VPS Root Şifresi
root@158.220.101.218: Cemocan01

# Admin Panel Varsayılan (DEĞİŞTİR!)
admin@sms-panel.com: admin123

# MongoDB
Şifre yok (localhost only)
```

### Güvenlik Kontrolleri

```bash
# Firewall durumu
ufw status

# Açık portlar
ufw status numbered

# Sadece gerekli portlar açık olmalı:
# 22 (SSH), 80 (HTTP), 443 (HTTPS)
```

---

## 🗂️ BACKUP

### Manuel Backup

```bash
# MongoDB backup
mongodump --db sms-panel --out /backup/$(date +%Y%m%d)

# Kod backup
cd /opt
tar -czf sms-panel-backup-$(date +%Y%m%d).tar.gz sms-panel/
```

### Restore

```bash
# MongoDB restore
mongorestore --db sms-panel /backup/20241207/sms-panel

# Kod restore
cd /opt
tar -xzf sms-panel-backup-20241207.tar.gz
```

---

## 📞 HIZLI KOMUTLAR

### Tek Komutla Durum Kontrolü

```bash
echo "=== PM2 ===" && pm2 status && \
echo -e "\n=== MongoDB ===" && systemctl status mongod --no-pager && \
echo -e "\n=== Nginx ===" && systemctl status nginx --no-pager && \
echo -e "\n=== Port 3000 ===" && netstat -tulpn | grep 3000
```

### Tek Komutla Yeniden Başlatma

```bash
pm2 restart sms-panel-backend && \
systemctl reload nginx && \
echo "✅ Tüm servisler yeniden başlatıldı!"
```

### Tek Komutla Log Kontrolü

```bash
pm2 logs sms-panel-backend --lines 30 --nostream
```

---

## 🎯 ÖNEMLİ İPUÇLARI

1. **Her zaman önce local'de test edin** - Production'a direkt push etmeyin
2. **Browser cache temizleyin** - Ctrl+F5 veya Cmd+Shift+R
3. **Admin şifresini değiştirin** - Varsayılan şifre production'da kalmamalı
4. **Düzenli backup alın** - MongoDB ve kod dosyalarını
5. **Logları kontrol edin** - Hata olduğunda ilk bakılacak yer
6. **PM2'yi kaydedin** - `pm2 save` ile değişiklikleri sakla
7. **Nginx config test** - `nginx -t` ile deploy öncesi kontrol

---

## 📚 KAYNAKLAR

- **DEV-GUIDE.md** - Detaylı development rehberi
- **README.md** - Proje genel bilgiler
- **Backend Docs** - `/opt/sms-panel/sms-panel/backend/`
- **Frontend** - `/opt/sms-panel/sms-panel/frontend/`
- **Android** - `/opt/sms-panel/sms-panel/android/`

---

## ⚡ YARDIM LAZIMSA

```bash
# PM2 yardım
pm2 --help

# Nginx test
nginx -t

# MongoDB bağlantı test
mongosh sms-panel --eval "db.runCommand({ ping: 1 })"

# Sistem bilgileri
uname -a
cat /etc/os-release
```

---

**Son Güncelleme:** 7 Aralık 2024
**VPS IP:** 158.220.101.218
**Branch:** claude/fix-veriyor-login-fetch-01DLFeXF7zGqnBMyW7bZ711c
