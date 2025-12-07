# SMS Panel - Development Guide

## 🔧 Development Ortamı (Test)

### Backend Başlatma

```bash
cd sms-panel
chmod +x dev-start.sh
./dev-start.sh
```

Backend `http://localhost:3000` adresinde çalışacak.

### Frontend Başlatma

**Yeni terminal açın:**

```bash
cd sms-panel
chmod +x dev-frontend.sh
./dev-frontend.sh
```

Frontend `http://localhost:8080` adresinde çalışacak:
- Admin Panel: http://localhost:8080/admin-panel.html
- User Panel: http://localhost:8080/user-panel.html

**Not:** `dev-frontend.sh` script'i otomatik olarak:
- API_URL'i `http://localhost:3000/api` olarak ayarlar
- Çıkışta geri `/api` olarak değiştirir (production için)

### Test Akışı

1. `dev-start.sh` ile backend'i başlat
2. `dev-frontend.sh` ile frontend'i başlat
3. Değişikliklerinizi yapın
4. Test edin
5. Her şey çalışıyorsa production'a deploy edin

---

## 🚀 Production Ortamı (VPS)

### İlk Kurulum

```bash
# VPS'e bağlanın
ssh root@158.220.101.218

# Kurulum script'ini çalıştırın
cd /opt
bash <(curl -s https://raw.githubusercontent.com/CanOzseven/sms-project/main/sms-panel/install.sh)
```

### Güncelleme

```bash
# VPS'e bağlanın
ssh root@158.220.101.218

# Güncellemeleri çekin
cd /opt/sms-panel
git pull origin claude/fix-veriyor-login-fetch-01DLFeXF7zGqnBMyW7bZ711c

# Backend'i yeniden başlatın
pm2 restart sms-panel-backend

# Nginx'i yenileyin
systemctl reload nginx
```

---

## 📝 Admin Şifresi Değiştirme

### Yöntem 1: Admin Panel UI'dan

1. http://158.220.101.218/admin-panel.html adresine gidin
2. Giriş yapın: admin@sms-panel.com / admin123
3. Sağ üstteki profil ikonuna tıklayın
4. "Hesap Ayarları" seçin
5. Yeni şifre girin

### Yöntem 2: MongoDB'den (VPS)

```bash
# VPS'e bağlanın
ssh root@158.220.101.218

# MongoDB shell'e girin
mongosh sms-panel

# Şifreyi değiştirin (bcrypt ile hashlenmiş)
use sms-panel
db.users.updateOne(
  { email: "admin@sms-panel.com" },
  { $set: { password: "$2a$10$yeniHashlenmisŞifre" } }
)
```

**Şifre hashleme için:**

```bash
node -e "console.log(require('bcryptjs').hashSync('YeniŞifre123', 10))"
```

---

## 👥 Kullanıcı Ekleme

### Admin Panel'den

1. Admin Panel'e giriş yapın
2. Sol menüden "Kullanıcılar" seçin
3. "+ Yeni Kullanıcı" butonuna tıklayın
4. Formu doldurun:
   - Ad Soyad
   - Email
   - Şifre
   - Rol (User/Admin)
   - Durum (Aktif/Pasif)
   - Yetkili Cihazlar (checkboxlar)
5. "Kaydet" butonuna tıklayın

### MongoDB'den (Manuel)

```bash
mongosh sms-panel

use sms-panel
db.users.insertOne({
  name: "Test User",
  email: "test@example.com",
  password: "$2a$10$hashedPassword",
  role: "user",
  status: "active",
  authorizedDevices: [],
  createdAt: new Date(),
  lastLogin: null
})
```

---

## 🔄 Geliştirme İş Akışı

### 1. Local'de Geliştirme

```bash
# Backend başlat (Terminal 1)
./dev-start.sh

# Frontend başlat (Terminal 2)
./dev-frontend.sh

# Test et
# http://localhost:8080/admin-panel.html
```

### 2. Git Commit

```bash
git add .
git commit -m "feat: Yeni özellik eklendi"
git push origin branch-adi
```

### 3. Production'a Deploy

```bash
# VPS'e bağlan
ssh root@158.220.101.218

# Güncellemeleri çek
cd /opt/sms-panel
git pull origin branch-adi

# Restart
pm2 restart sms-panel-backend
systemctl reload nginx
```

---

## 🐛 Hata Ayıklama

### Backend Logları

```bash
# VPS'te
pm2 logs sms-panel-backend

# Son 100 satır
pm2 logs sms-panel-backend --lines 100

# Canlı log takibi
pm2 logs sms-panel-backend --lines 0
```

### MongoDB Kontrol

```bash
# Bağlantı kontrolü
mongosh sms-panel --eval "db.runCommand({ ping: 1 })"

# Koleksiyonları listele
mongosh sms-panel --eval "db.getCollectionNames()"

# Kullanıcıları listele
mongosh sms-panel --eval "db.users.find().pretty()"
```

### Nginx Kontrol

```bash
# Konfig test
nginx -t

# Yeniden yükle
systemctl reload nginx

# Logları kontrol et
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## 💡 İpuçları

- Development'ta değişiklikler otomatik yüklenmez, browser'ı yenileyin (Ctrl+F5)
- Production'da her zaman önce local'de test edin
- Database backup'ı almayı unutmayın: `mongodump --db sms-panel`
- PM2 otomatik restart için: `pm2 startup` ve `pm2 save`

---

## 🆘 Sık Karşılaşılan Sorunlar

### "Failed to fetch" hatası

- Backend çalışıyor mu? → `pm2 status`
- MongoDB çalışıyor mu? → `systemctl status mongod`
- API_URL doğru mu? → Development: `localhost:3000/api`, Production: `/api`

### Sidebar açılmıyor

- Browser console'u kontrol edin (F12)
- JavaScript hataları var mı?

### Kullanıcı login olamıyor

- Şifre doğru mu?
- User status "active" mi? → MongoDB'de kontrol edin
- Backend loglarını kontrol edin → `pm2 logs`
