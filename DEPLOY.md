# 🚀 Ring Panel - Production Deployment Guide

## 📋 Production Branch
**Branch:** `claude/user-panel-messaging-notifications-014SmdxrfJ9Q4o4EwwKcu6hc`

Bu branch production-ready olup tüm değişiklikleri içerir.

---

## 🔧 VDS'te Deployment Adımları

### 1️⃣ Repository'yi Clone/Pull Et

```bash
cd /home/user
git clone <repo-url> sms-project
# veya eğer zaten varsa:
cd /home/user/sms-project
git fetch origin
git checkout claude/user-panel-messaging-notifications-014SmdxrfJ9Q4o4EwwKcu6hc
git pull origin claude/user-panel-messaging-notifications-014SmdxrfJ9Q4o4EwwKcu6hc
```

### 2️⃣ Backend Dependencies

```bash
cd sms-panel/backend
npm install
```

### 3️⃣ Environment Variables

`.env` dosyasını düzenle:

```bash
nano sms-panel/backend/.env
```

```env
MONGODB_URI=mongodb://localhost:27017/ring-panel
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=3000
NODE_ENV=production
CORS_ORIGIN=*
```

### 4️⃣ MongoDB Kurulumu (eğer yoksa)

```bash
# MongoDB yükle
sudo apt update
sudo apt install -y mongodb

# MongoDB başlat
sudo systemctl start mongodb
sudo systemctl enable mongodb
```

### 5️⃣ PM2 ile Backend Başlat

```bash
# PM2 yükle (eğer yoksa)
sudo npm install -g pm2

# Backend'i başlat
cd /home/user/sms-project/sms-panel/backend
pm2 start server.js --name ring-panel

# Otomatik başlatmayı ayarla
pm2 save
pm2 startup
```

### 6️⃣ Nginx ile Frontend Serve Et

```bash
# Nginx config
sudo nano /etc/nginx/sites-available/ring-panel
```

```nginx
server {
    listen 80;
    server_name 158.220.101.218;

    # Frontend
    location / {
        root /home/user/sms-project/sms-panel/frontend;
        index login.html;
        try_files $uri $uri/ /login.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Config'i enable et
sudo ln -s /etc/nginx/sites-available/ring-panel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 📊 Log Kontrolleri

```bash
# Backend logs
pm2 logs ring-panel

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🔄 Update (Yeni değişiklikler geldiğinde)

```bash
cd /home/user/sms-project
git pull origin claude/user-panel-messaging-notifications-014SmdxrfJ9Q4o4EwwKcu6hc
cd sms-panel/backend
npm install
pm2 restart ring-panel
```

---

## ✅ Test Kullanıcıları

Deployment sonrası test için:

```bash
cd sms-panel/backend
node scripts/create-test-users.js
```

**Test Credentials:**
- **Admin:** username: `admin`, password: `admin123`
- **User:** username: `testuser`, password: `test123`

---

## 🌐 Erişim URL'leri

- **Login:** `http://158.220.101.218/login.html`
- **Admin Panel:** `http://158.220.101.218/admin-panel.html` (auto-redirect)
- **User Panel:** `http://158.220.101.218/user-panel.html` (auto-redirect)
- **API Health:** `http://158.220.101.218:3000/health`

---

## 🎉 Yeni Özellikler (Bu Deployment'ta)

1. ✅ Ring Panel rebranding
2. ✅ Username-based authentication
3. ✅ Unified login system (tek giriş sayfası)
4. ✅ Auto-refresh toggle (5 saniye)
5. ✅ Permissions card layout
6. ✅ Delete conversation
7. ✅ Device tab selection fix
8. ✅ Device logout on deletion (polling)
9. ✅ Daily SMS cleanup (23:59)
10. ✅ Single session management
11. ✅ Notification sound toggle
12. ✅ Account settings

---

## 🔥 Firewall Ayarları

```bash
# Port 80 (HTTP)
sudo ufw allow 80/tcp

# Port 3000 (Backend API - opsiyonel, nginx proxy kullanıyorsak gerekmez)
sudo ufw allow 3000/tcp

# Firewall'u enable et
sudo ufw enable
```

---

## 📞 Sorun Giderme

### Backend başlamıyor:
```bash
pm2 logs ring-panel
# MongoDB çalışıyor mu?
sudo systemctl status mongodb
```

### Frontend yüklenmiyor:
```bash
sudo nginx -t
sudo systemctl status nginx
```

### API çalışmıyor:
```bash
curl http://localhost:3000/health
```

---

**Deploy başarılı olduğunda:**
```bash
pm2 status
# ring-panel online olmalı
```

