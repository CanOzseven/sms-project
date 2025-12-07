# 📱 SMS Panel - Müşteri Kullanım Talimatları

## Android Uygulama Kurulumu

### 1. APK Dosyasını İndirin

Geliştiriciden aldığınız **SMSPanel-vX.X.X.apk** dosyasını telefonunuza indirin.

### 2. Bilinmeyen Kaynaklardan Kurulumu Aktif Edin

**Android 8.0 ve Üzeri:**
1. Ayarlar → Güvenlik → Bilinmeyen Kaynaklar
2. Dosya yöneticisi uygulamasına izin verin

**Android 12 ve Üzeri:**
1. APK'yı açmaya çalıştığınızda izin isteyecek
2. "Bu kaynak için izin ver" seçeneğini işaretleyin

### 3. APK'yı Yükleyin

1. İndirilen APK dosyasını açın
2. "Yükle" butonuna tıklayın
3. Kurulum tamamlanana kadar bekleyin
4. "Aç" butonuna tıklayın

### 4. İzinleri Verin

Uygulama şu izinleri isteyecek:

- ✅ **SMS İzni** - SMS'leri okumak ve almak için
- ✅ **Kişiler İzni** - Kişi isimlerini almak için
- ✅ **Bildirim İzni** - Durum bildirimleri için

**Tüm izinleri vermelisiniz**, aksi halde uygulama çalışmaz.

---

## Uygulama Aktivasyonu

### 5. Server URL'i Girin

İlk açılışta iki bilgi girmeniz gerekecek:

**Server URL (Sunucu Adresi):**
```
http://158.220.101.218
```

> ⚠️ Önemli: Sonundaki `/` işaretini koymayın!
> ✅ Doğru: `http://158.220.101.218`
> ❌ Yanlış: `http://158.220.101.218/`

### 6. Aktivasyon Kodunu Girin

Geliştiriciden aldığınız **8 haneli aktivasyon kodunu** girin.

**Örnek:** `A1B2C3D4`

> 📝 Not: Kod büyük/küçük harf duyarlıdır

### 7. Aktif Et

"Aktif Et" butonuna tıklayın.

**Başarılı Aktivasyon:**
```
✅ Aktivasyon başarılı!
```

Ekran otomatik olarak ana ekrana geçecek.

**Başarısız Aktivasyon:**
```
❌ Geçersiz aktivasyon kodu
❌ Sunucuya bağlanılamadı
```

Bu durumda:
- Server URL'i kontrol edin
- Aktivasyon kodunu kontrol edin
- İnternet bağlantınızı kontrol edin
- Geliştiriciye başvurun

---

## Ana Ekran

Aktivasyondan sonra göreceğiniz bilgiler:

### Durum Göstergeleri

```
➜ Device: Samsung Galaxy S21    (Cihaz adı)
➜ Status: ACTIVE █               (Durum: Aktif)
⏱ Uptime: 01:23:45               (Çalışma süresi)
```

### İstatistikler

```
TOTAL SMS        SYNCED SMS       LAST SYNC
   156              156          ⏱ 14:35:21
```

- **Total SMS:** Telefondaki toplam SMS sayısı
- **Synced SMS:** Sunucuya yüklenen SMS sayısı
- **Last Sync:** Son senkronizasyon zamanı

### Activity Log

Uygulama aktivitelerini gösterir:
```
[14:35:21] ✓ SMS senkronize edildi
[14:34:15] ✓ Heartbeat gönderildi
[14:30:00] ✓ Arka plan servisi başlatıldı
```

---

## Nasıl Çalışır?

### Otomatik Senkronizasyon

Uygulama arka planda çalışır ve:

1. **Her 5 dakikada bir** tüm SMS'leri sunucuya yükler
2. **Yeni SMS geldiğinde** anında senkronize eder
3. **Kişi bilgilerini** SMS'lerle birlikte gönderir

### Arka Plan Çalışması

- Uygulama kapatılsa bile çalışmaya devam eder
- Telefon yeniden başlatıldığında otomatik başlar
- Pil tasarrufu optimizasyonlarına uyumlu

---

## Sık Sorulan Sorular

### ❓ Uygulama SMS'leri silecek mi?

**Hayır!** Uygulama sadece SMS'leri okur, silmez veya değiştirmez.

### ❓ İnternet olmadan çalışır mı?

Hayır, SMS'leri sunucuya göndermek için internet gerekir. Ancak:
- İnternet olmadığında SMS'ler cihazda bekler
- İnternet geldiğinde otomatik gönderilir

### ❓ Hangi SMS'ler gönderiliyor?

**Tüm SMS'ler:**
- Gelen SMS'ler
- Giden SMS'ler
- Geçmiş SMS'ler (ilk senkronizasyonda)

### ❓ Pil tüketimi nasıl?

Minimal pil tüketimi:
- Arka planda verimli çalışır
- Sadece gerektiğinde sunucuya bağlanır
- Modern pil optimizasyonlarını destekler

### ❓ Gizlilik nasıl?

- SMS'ler şifreli bağlantı üzerinden gönderilir
- Sadece yetkilendirilmiş sunucuya gider
- Üçüncü taraflarla paylaşılmaz

### ❓ Uygulama güncellenecek mi?

Evet, yeni sürümler:
- APK dosyası olarak geliştiriciden alınır
- Eski sürümün üzerine kurulur
- Ayarlar ve aktivasyon korunur

---

## Sorun Giderme

### 🔴 "Sunucuya bağlanılamadı" Hatası

**Çözümler:**
1. İnternet bağlantınızı kontrol edin
2. Server URL'i doğru girdiğinizden emin olun
3. VPN kullanıyorsanız kapatın
4. Mobil veri ile deneyin
5. Geliştiriciye başvurun (sunucu kapalı olabilir)

### 🔴 "Geçersiz aktivasyon kodu" Hatası

**Çözümler:**
1. Kodu doğru girdiğinizden emin olun
2. Boşluk bırakmayın
3. Büyük/küçük harf duyarlılığına dikkat edin
4. Geliştiriciden yeni kod isteyin

### 🔴 SMS'ler Senkronize Olmuyor

**Kontrol edin:**
1. İzinler verilmiş mi? (Ayarlar → Uygulamalar → SMS Panel → İzinler)
2. İnternet var mı?
3. Uygulama arka planda çalışıyor mu?
4. Pil tasarrufu uygulama için kapalı mı?

**Çözüm:**
- Uygulamayı tamamen kapatın
- Tekrar açın
- 1-2 dakika bekleyin
- Activity Log'da "Senkronize edildi" mesajını kontrol edin

### 🔴 Bildirimler Gelmiyor

**Çözüm:**
1. Ayarlar → Uygulamalar → SMS Panel → Bildirimler
2. "Bildirimlere izin ver" açık olmalı
3. "Sessiz bildirimler" kapalı olmalı

### 🔴 Telefon Yeniden Başladıktan Sonra Çalışmıyor

**Çözüm:**
1. Uygulamayı bir kez açın
2. Otomatik başlatma aktif olacak
3. Bir sonraki yeniden başlatmada otomatik çalışacak

---

## Pil Tasarrufu Ayarları

Uygulamanın arka planda sorunsuz çalışması için:

### Samsung (One UI)

1. Ayarlar → Uygulamalar → SMS Panel
2. Pil → Pil kullanımı → Optimize edilmiyor
3. Arka planda kısıtlama → Kısıtlama yok

### Xiaomi (MIUI)

1. Ayarlar → Uygulamalar → SMS Panel
2. Pil tasarrufu → Kısıtlama yok
3. Otomatik başlatma → Açık
4. Diğer izinler → Arka planda çalış → İzin ver

### Huawei (EMUI)

1. Ayarlar → Uygulamalar → SMS Panel
2. Pil → Uygulama başlatma → Manuel
3. Otomatik başlatma, İkincil başlatma, Arka planda çalış → Tümünü açık

### Stock Android

1. Ayarlar → Uygulamalar → SMS Panel
2. Pil → Pil optimizasyonu → Optimize edilmiyor

---

## Uygulama Kaldırma

Uygulamayı kaldırmak isterseniz:

1. Ayarlar → Uygulamalar → SMS Panel
2. Kaldır

**Not:** Kaldırdıktan sonra:
- SMS'ler telefonunuzda kalır
- Sunucudaki veriler silinmez
- Yeniden kurmak için aktivasyon kodu gerekir

---

## Destek

Sorun yaşıyorsanız:

📧 **E-posta:** Geliştiriciye başvurun
📱 **Telefon:** Destek hattını arayın
💬 **WhatsApp:** Ekran görüntüsü gönderin

**Destek için gerekli bilgiler:**
- Telefon modeli
- Android sürümü
- Hata mesajı
- Activity Log ekran görüntüsü

---

## Güvenlik İpuçları

✅ **Yapılması Gerekenler:**
- Aktivasyon kodunu güvenli tutun
- Sadece resmi APK'yı kurun
- İzinleri sadece uygulama istediğinde verin

❌ **Yapılmaması Gerekenler:**
- Aktivasyon kodunu paylaşmayın
- Bilinmeyen kaynaklardan başka APK kurmayın
- Uygulamaya gereksiz izinler vermeyin

---

**Uygulama Sürümü:** 1.0.0
**Son Güncelleme:** 7 Aralık 2024
**Platform:** Android 7.0+

---

## Hızlı Başlangıç Özeti

```
1. APK'yı yükle
2. İzinleri ver (SMS, Kişiler, Bildirimler)
3. Server URL: http://158.220.101.218
4. Aktivasyon Kodu: [8 haneli kod]
5. Aktif Et
6. Tamamdır! ✅
```

Kolay gelsin! 🚀
