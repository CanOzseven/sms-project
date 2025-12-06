# SMS Panel Sistemi

Production-ready SMS yonetim sistemi. Android cihazlardan SMS'leri toplayip merkezi bir panelden yonetmenizi saglar.

## Ozellikler

- **JWT Authentication** - Guvenli oturum yonetimi
- **Role-based Access Control** - Admin ve kullanici rolleri
- **Real-time SMS Sync** - Aninda SMS senkronizasyonu
- **Background Service** - Arka planda calisma
- **Activity Logging** - Detayli aktivite kaydi
- **Permission System** - Kullanici-cihaz yetki yonetimi

## Proje Yapisi

```
sms-panel/
├── backend/          # Node.js + Express + MongoDB API
├── frontend/         # Admin ve User panelleri (HTML/CSS/JS)
└── android/          # Android uygulamasi (Kotlin)
```

## Kurulum

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env
# .env dosyasini duzenleyin
npm start
```

**Gereksinimler:**
- Node.js 18+
- MongoDB 6+

**Ilk Admin Bilgileri:**
- Email: `admin@sms-panel.com`
- Password: `admin123`

> ⚠️ Production'da sifreyi degistirin!

### 2. Frontend

Frontend dosyalari statik HTML'dir. Herhangi bir web sunucusunda calistirabilirsiniz.

```bash
# Ornek: Python ile basit sunucu
cd frontend
python -m http.server 8080
```

Tarayicinizda:
- Admin Panel: `http://localhost:8080/admin-panel.html`
- User Panel: `http://localhost:8080/user-panel.html`

**API URL Ayari:**
HTML dosyalarinda `API_URL` degiskenini sunucu adresinize gore ayarlayin.

### 3. Android

1. Android Studio'da `android/` klasorunu acin
2. Gradle sync yapin
3. APK derleyin veya cihaza yukleyin

**Minimum Gereksinimler:**
- Android 7.0 (API 24)
- SMS, Kisi ve Bildirim izinleri

## API Endpointleri

### Admin Routes

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| POST | `/api/admin/login` | Admin girisi |
| GET | `/api/admin/stats` | Dashboard istatistikleri |
| GET | `/api/admin/users` | Kullanicilari listele |
| POST | `/api/admin/users` | Kullanici olustur |
| PUT | `/api/admin/users/:id` | Kullanici guncelle |
| DELETE | `/api/admin/users/:id` | Kullanici sil |
| GET | `/api/admin/devices` | Cihazlari listele |
| POST | `/api/admin/devices` | Cihaz olustur |
| GET | `/api/admin/permissions` | Yetkileri listele |
| POST | `/api/admin/permissions/grant` | Yetki ver |
| DELETE | `/api/admin/permissions/revoke` | Yetki kaldir |
| GET | `/api/admin/sms/all` | Tum SMS'leri getir |
| GET | `/api/admin/activity-logs` | Aktivite loglarini getir |

### User Routes

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| POST | `/api/user/login` | Kullanici girisi |
| GET | `/api/user/devices` | Yetkili cihazlari getir |
| GET | `/api/user/sms/:deviceId` | Cihazin SMS'lerini getir |
| GET | `/api/user/sms/:deviceId/contacts` | Konusmalari getir |
| PUT | `/api/user/sms/:smsId/read` | SMS'i okundu isaretle |
| GET | `/api/user/profile` | Profil bilgisi |
| PUT | `/api/user/profile` | Profil guncelle |

### Device Routes (Android icin)

| Method | Endpoint | Aciklama |
|--------|----------|----------|
| POST | `/api/device/activate` | Cihaz aktivasyonu |
| POST | `/api/device/sms` | SMS senkronizasyonu |
| POST | `/api/device/sms/single` | Tek SMS gonder |
| POST | `/api/device/heartbeat` | Cihaz heartbeat |
| GET | `/api/device/status` | Cihaz durumu |

## Kullanim Akisi

1. **Admin panelden cihaz olusturun** - Aktivasyon kodu otomatik uretilir
2. **Android uygulamasini kurun** - APK'yi cihaza yukleyin
3. **Aktivasyon kodunu girin** - Sunucu adresi ve kodu yazin
4. **SMS'ler otomatik senkronize edilir** - Arka planda calisir
5. **User panelden SMS'leri goruntuleverin** - Kullanicilara yetki verin

## Guvenlik

- JWT token ile kimlik dogrulama
- Bcrypt ile sifre hashleme
- Role-based access control
- Aktivasyon kodu ile cihaz dogrulama
- Aktivite loglama

## Ortam Degiskenleri

```env
MONGODB_URI=mongodb://localhost:27017/sms-panel
JWT_SECRET=your-super-secret-jwt-key
PORT=3000
NODE_ENV=development
CORS_ORIGIN=*
```

## Lisans

MIT License

## Destek

Sorunlar icin GitHub Issues kullanin.
