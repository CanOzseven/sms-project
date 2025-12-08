# SMS Panel - Deployment Guide

## 🚀 Hızlı Başlangıç

### 1. Servisleri Başlatma

```bash
./start.sh
```

Bu script:
- ✅ Backend'i başlatır (Port 3000)
- ✅ Frontend'i başlatır (Port 8080)
- ✅ MongoDB bağlantısını kontrol eder
- ✅ .env dosyasını otomatik oluşturur (yoksa)
- ✅ npm install'ı otomatik çalıştırır (gerekirse)

### 2. Servisleri Durdurma

```bash
./stop.sh
```

Bu script:
- ❌ Tüm backend proseslerini durdurur
- ❌ Frontend sunucusunu kapatır
- 🧹 PID dosyalarını temizler

### 3. Güncelleme

```bash
./update.sh
```

Bu script:
- 🔄 Servisleri durdurur
- 📦 Git pull yapar (opsiyonel)
- 📥 npm install ile bağımlılıkları günceller
- 🚀 Servisleri yeniden başlatır

## 📋 Ön Gereksinimler

### Backend İçin
- **Node.js:** v18.0.0 veya üzeri
- **MongoDB:** v6.0 veya üzeri (çalışır durumda olmalı)
- **npm:** Node.js ile birlikte gelir

### Frontend İçin
- **Python:** v3.x veya v2.x (HTTP server için)
- Alternatif: `npx http-server` kullanabilirsiniz

## 🔧 Manuel Kurulum

### Backend

```bash
cd sms-panel/backend

# Ortam değişkenlerini ayarla
cp .env.example .env
nano .env  # Düzenle

# Bağımlılıkları kur
npm install

# Başlat
npm start
```

### Frontend

```bash
cd sms-panel/frontend

# Python 3 ile
python3 -m http.server 8080

# Veya Python 2 ile
python -m SimpleHTTPServer 8080

# Veya npx ile
npx http-server -p 8080
```

## 🌐 Erişim Adresleri

| Servis | URL | Açıklama |
|--------|-----|----------|
| Backend API | http://localhost:3000 | REST API endpoint'leri |
| Admin Panel | http://localhost:8080/admin-panel.html | Yönetim paneli |
| User Panel | http://localhost:8080/user-panel.html | Kullanıcı paneli |

## 🔐 İlk Giriş Bilgileri

### Admin Hesabı
```
Email: admin@sms-panel.com
Password: admin123
```

⚠️ **ÖNEMLİ:** İlk girişten sonra şifreyi mutlaka değiştirin!

## 📁 Dizin Yapısı

```
sms-project/
├── start.sh                 # Servisleri başlat
├── stop.sh                  # Servisleri durdur
├── update.sh                # Güncelle ve yeniden başlat
├── DEPLOYMENT.md            # Bu dosya
├── .backend.pid             # Backend proses ID (otomatik)
├── .frontend.pid            # Frontend proses ID (otomatik)
└── sms-panel/
    ├── backend/             # Node.js API
    │   ├── server.js        # Ana sunucu dosyası
    │   ├── .env             # Ortam değişkenleri
    │   ├── models/          # MongoDB modelleri
    │   ├── routes/          # API route'ları
    │   └── middleware/      # Auth vs. middleware'ler
    ├── frontend/            # HTML/CSS/JS paneller
    │   ├── admin-panel.html
    │   └── user-panel.html
    └── android/             # Kotlin Android uygulaması
        └── app/
```

## 🐛 Sorun Giderme

### Backend Başlamıyor

```bash
# MongoDB çalışıyor mu kontrol et
sudo systemctl status mongod

# MongoDB'yi başlat
sudo systemctl start mongod

# Port 3000 kullanılıyor mu?
lsof -ti:3000
kill -9 $(lsof -ti:3000)  # Gerekirse
```

### Frontend Başlamıyor

```bash
# Port 8080 kullanılıyor mu?
lsof -ti:8080
kill -9 $(lsof -ti:8080)  # Gerekirse

# Python kurulu mu?
python3 --version
```

### npm install Hataları

```bash
# Node sürümünü kontrol et
node --version  # 18+ olmalı

# npm cache temizle
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 🔄 Production Deployment

### PM2 ile Çalıştırma (Önerilen)

```bash
# PM2'yi global olarak kur
npm install -g pm2

# Backend'i PM2 ile başlat
cd sms-panel/backend
pm2 start server.js --name sms-panel-backend

# Otomatik restart için kaydet
pm2 save
pm2 startup
```

### Nginx Reverse Proxy (Opsiyonel)

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend
    location / {
        root /path/to/sms-project/sms-panel/frontend;
        index admin-panel.html;
    }
}
```

## 📊 Log Yönetimi

### Backend Logları

```bash
# Canlı log takibi
tail -f sms-panel/backend/logs/app.log

# Hata logları
tail -f sms-panel/backend/logs/error.log
```

### PM2 Logları

```bash
# Tüm logları göster
pm2 logs

# Sadece backend
pm2 logs sms-panel-backend

# Log dosyalarını temizle
pm2 flush
```

## 🔒 Güvenlik Notları

1. **JWT Secret:** `.env` dosyasında güçlü bir secret kullanın
2. **MongoDB:** Kullanıcı adı ve şifre ile koruyun
3. **CORS:** Production'da sadece güvenli origin'lere izin verin
4. **HTTPS:** SSL sertifikası kullanın (Let's Encrypt önerilir)
5. **Admin Şifresi:** İlk kurulumda mutlaka değiştirin

## 📞 Destek

Sorun yaşarsanız:
- 📝 Log dosyalarını kontrol edin
- 🐛 GitHub Issues'da bildirin
- 📧 Teknik destek ile iletişime geçin

---

**Son Güncelleme:** 2025-12-08
**Versiyon:** 1.0.0
