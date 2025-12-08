# Ring Panel Deployment Scripts

Bu dizinde Ring Panel sistemini deploy etmek için gerekli scriptler bulunmaktadır.

## 📋 Script Listesi

### 1. `deploy-initial.sh` - İlk Kurulum
Sistemi sıfırdan kurar, veritabanını temizler ve sadece admin kullanıcısı ile başlatır.

**Ne zaman kullanılır:**
- İlk kurulumda
- Sistemi tamamen sıfırlamak istediğinizde
- Veritabanını temizlemek istediğinizde

**Çalıştırma:**
```bash
cd /root/sms-project/scripts
chmod +x deploy-initial.sh
./deploy-initial.sh
```

**Ne yapar:**
1. Git güncellemelerini çeker
2. Backend dependencies kurar
3. Veritabanını sıfırlar (tüm data silinir!)
4. Admin kullanıcısı oluşturur
5. PM2'de backend'i başlatır/restart eder
6. Nginx'i reload eder

**⚠️ UYARI:** Bu script veritabanındaki TÜM verileri siler!

---

### 2. `deploy-update.sh` - Güncelleme
Kod güncellemelerini deploy eder, veritabanını korur.

**Ne zaman kullanılır:**
- Frontend/backend kodunda değişiklik olduğunda
- Yeni özellik eklendiğinde
- Bug fix deploy edildiğinde

**Çalıştırma:**
```bash
cd /root/sms-project/scripts
chmod +x deploy-update.sh
./deploy-update.sh
```

**Ne yapar:**
1. Git güncellemelerini çeker
2. Backend dependencies günceller
3. PM2'de backend'i restart eder
4. Nginx'i reload eder
5. Log çıktısı gösterir

**✅ GÜVENLİ:** Veritabanını etkilemez, data korunur.

---

### 3. `restart.sh` - Hızlı Restart
Backend'i hızlıca restart eder, kod çekmez.

**Ne zaman kullanılır:**
- Backend takıldığında
- Hızlıca restart gerektiğinde
- Ayar değişiklikleri sonrası

**Çalıştırma:**
```bash
cd /root/sms-project/scripts
chmod +x restart.sh
./restart.sh
```

**Ne yapar:**
1. PM2'de backend'i restart eder
2. Durum gösterir
3. Son logları gösterir

**⚡ EN HIZLI:** Sadece restart, güncelleme çekmez.

---

## 🔄 Deployment Akışı

### İlk Kurulum
```bash
# 1. Sistemi sıfırdan kur
./deploy-initial.sh

# 2. Login yap ve test et
# http://158.220.101.218/login.html
# Username: admin
# Password: admin123
```

### Kod Güncellemesi
```bash
# 1. Güncellemeleri deploy et
./deploy-update.sh

# 2. Logları kontrol et
pm2 logs sms-panel-backend

# 3. Test et
# http://158.220.101.218/login.html
```

### Hızlı Müdahale
```bash
# Backend takıldıysa hızlıca restart
./restart.sh
```

---

## 🔍 Log Kontrolü

```bash
# Canlı logları izle
pm2 logs sms-panel-backend

# Son 50 satırı göster
pm2 logs sms-panel-backend --lines 50

# Sadece hata logları
pm2 logs sms-panel-backend --err

# Logları temizle
pm2 flush
```

---

## 🛠️ Troubleshooting

### Port 3000 kullanımda
```bash
# Port'u kullanan process'i bul
lsof -i :3000

# PM2'yi tamamen durdur
pm2 stop all
pm2 delete all

# Tekrar başlat
./deploy-initial.sh
```

### MongoDB bağlantı hatası
```bash
# MongoDB durumunu kontrol et
systemctl status mongod

# MongoDB loglarını kontrol et
tail -f /var/log/mongodb/mongod.log

# MongoDB'yi restart et
systemctl restart mongod
```

### Nginx hatası
```bash
# Nginx config test
nginx -t

# Nginx restart
systemctl restart nginx

# Nginx logları
tail -f /var/log/nginx/error.log
```

---

## 📊 Sistem Durumu

```bash
# PM2 processes
pm2 list

# PM2 monitoring
pm2 monit

# Sistem kaynakları
pm2 status
```

---

## 🔐 Güvenlik

### Production'da yapılması gerekenler:
1. Admin şifresini değiştirin
2. `.env` dosyasını koruyun
3. MongoDB'yi dışarıdan erişime kapatın
4. Nginx SSL sertifikası ekleyin
5. PM2 startup ayarlayın:
```bash
pm2 startup
pm2 save
```

---

## 📝 Notlar

- Tüm scriptler `/root/sms-project` dizininden çalışır
- VPS IP: `158.220.101.218`
- Branch: `claude/user-panel-messaging-notifications-014SmdxrfJ9Q4o4EwwKcu6hc`
- Backend Port: `3000`
- Nginx Port: `80`
