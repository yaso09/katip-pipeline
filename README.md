# 📚 Katip Pipeline

MEB OGM Materyal soru bankasındaki içerikleri otonom olarak (web scraping) çeken ve doğrudan GitHub deponuza senkronize eden, modern arayüzlü ve güvenli veri hattı (pipeline).

## 🌟 Öne Çıkan Özellikler

- ☁️ **Tamamen Bulut Tabanlı:** Yerel diskte yer kaplamaz; tüm veriler, ilerleme durumu (progress) ve günlükler doğrudan GitHub API üzerinden senkronize edilir.
- 🎨 **Akademik Dashboard:** "Crimson Pro" ve "Inter" fontlarıyla tasarlanmış, makale dizgisi zarafetinde modern ve minimalist yönetim paneli.
- 🛡️ **GitHub OAuth2 Güvenliği:** Paneliniz tamamen korumalıdır. Sadece sizin belirlediğiniz GitHub yetkilisi giriş yapabilir.
- ⚡ **Axios ile Güçlü Altyapı:** Native fetch ve curl bağımlılıkları yerine profesyonel Axios kütüphanesi ile daha stabil bağlantı ve hata yönetimi.
- 🔄 **409 Conflict Kurtarma:** GitHub API'deki SHA uyuşmazlığı hatalarını otomatik algılar ve veri kaybı olmadan senkronizasyonu sürdürür.
- 🚀 **Vercel Uyumlu:** Sunucusuz (serverless) ortamlarda çalışması için dosya sistemi yazma izinlerine ihtiyaç duymaz.

## ⚙️ Hızlı Kurulum

1.  Projeyi klonlayın ve bağımlılıkları yükleyin:
    ```bash
    npm install
    ```
2.  `.env` dosyanızı oluşturun (detaylar aşağıda).
3.  Uygulamayı başlatın:
    ```bash
    npm start
    ```
4.  Tarayıcıdan erişin: `http://localhost:3000`

---

## 🛠️ GitHub OAuth Uygulaması Oluşturma (Adım Adım)

Yönetici panelini güvenli hale getirmek için bir GitHub OAuth uygulamasına ihtiyacınız vardır:

1.  GitHub hesabınızda **Settings > Developer Settings > OAuth Apps** yolunu izleyin.
2.  **"New OAuth App"** butonuna tıklayın.
3.  Aşağıdaki bilgileri doldurun:
    - **Application Name:** Katip Pipeline (veya dilediğiniz bir isim)
    - **Homepage URL:** Bilgisayarda test ediyorsanız `http://localhost:3000`, Vercel'deyseniz kendi linkiniz (örn: `https://katip-pipeline.vercel.app`).
    - **Authorization callback URL:** Bilgisayar için `http://localhost:3000/auth/github/callback`, Vercel için `https://...vercel.app/auth/github/callback`.
4.  **"Register application"** dedikten sonra **"Client ID"**yi kopyalayın.
5.  **"Generate a new client secret"** butonuna basarak gizli anahtarı oluşturun ve kopyalayın.
6.  Bu bilgileri `.env` dosyanızdaki ilgili kısımlara yapıştırın.

---

## 🔑 Ortam Değişkenleri (.env)

| Değişken | Açıklama | Örnek / Durum |
| :--- | :--- | :--- |
| `GITHUB_TOKEN` | GitHub API erişim anahtarınız (fine-grained veya classic). | `ghp_...` |
| `GITHUB_REPO` | Verilerin kaydedileceği depo. | `Kullanici/DepoAdi` |
| `GITHUB_CLIENT_ID` | Oluşturduğunuz OAuth uygulamasının ID'si. | `Ov23...` |
| `GITHUB_CLIENT_SECRET` | Oluşturduğunuz OAuth uygulamasının gizli anahtarı. | `31d9...` |
| `ADMIN_GITHUB_USERNAME` | Paneli yönetmeye yetkili tek GitHub kullanıcı adınız. | `yaso09` |
| `APP_URL` | (Opsiyonel) Vercel'de özel domain kullanıyorsanız adresi. | `https://site.com` |

---

## 🚀 Vercel Üzerinde Yayınlama

Bu proje Vercel ile tam uyumludur:
1.  GitHub deponuzu Vercel'e bağlayın.
2.  Vercel Dashboard'da **Environment Variables** kısmına yukarıdaki tüm `.env` değişkenlerini tek tek ekleyin.
3.  Deploy edin. Dinamik URL yapısı sayesinde callback adresiniz otomatik algılanacaktır.

## 🖥️ Arayüz Kullanımı

- **Sol Sütun:** Sistem durumunu anlık izleyebilir, toplam başarılı/hatalı soru sayısını görebilir ve GitHub'daki dosyalarınızın son durumlarını (SHA) takip edebilirsiniz.
- **Sağ Sütun:** "İşlem Günlüğü" kısmından arka planda akıp giden scrap loglarını, çekilen soruların ID'lerini canlı olarak izleyebilirsiniz.
- **Durdur/Başlat:** İstediğiniz an işlemi durdurabilir, kaldığı yerden devam ettirebilirsiniz.

---
*Gelişmiş eğitim teknolojileri veri akışı projeleri için tasarlanmıştır.*
