# 📚 Katip Pipeline

**Eğitim Materyalleri Otonom Veri Aktarım Sistemine Hoş Geldiniz!**

Katip Pipeline, Türkiye Cumhuriyeti Milli Eğitim Bakanlığı (MEB) kaynaklarından –özellikle OGM Materyal üzerinden– akademik içerikleri ve test bankası sorularını otonom olarak (web scraping ile) çeken ve doğrudan GitHub deponuza senkronize eden modern bir Node.js sistemidir.

## ✨ Öne Çıkan Özellikler

- ☁️ **"Sıfır" Veri Kaybı ve Doğrudan GitHub Senkronizasyonu:** Yerel disk yerine GitHub REST API'sini kullanan akıllı `sha` önbelleği (Caching) sayesinde **409 Conflict** hataları onarılmıştır. Tüm asenkron süreçler `Promise.all` ile saniye kaybetmeden asenkron çalışır ve sunucu (GitHub) API limitlerini aşmadan senkronizasyon sağlar.
- 🇹🇷 **Native Fetch ile Kesin Encoding (Türkçe Desteği):** Türkçe karakterleri (windows-1254 vb.) sorunsuz çekip dönüştürebilmek için yavaş ve sorunlu konsol `curl` bağımlılığı kaldırılmış, doğrudan sistem çekirdeğindeki Native `fetch` yapısına geçirilmiştir. Sorularınızda bozuk karakter yaşanmaz.
- 🎨 **Akademik & Minimalist "Dashboard" (Kontrol Paneli):** `Express.js` altyapısında sunulan arayüzümüz; göz yormayan açık kağıt hissiyatı, Crimson Pro serif stili (makale dizgisi) hissi ile terminal pencerelerine ihtiyacı ortadan kaldırır. "Durdur/Başlat" fonksiyonlarına tam yetkilidir.
- 🛡️ **GitHub OAuth2 Yönetici Koruması:** Web arayüzünüz tamamen size aittir. `passport-github2` ile şifrelenen web sunucusuna sadece `.env` içerisinde belirlediğiniz tek veya belirli bir "Yönetici (Admin)" kullanıcı adı dışında hiçbir GitHub hesabı erişemez. Projeniz güvendedir!

## 🚀 Kurulum

1. Depoyu bilgisayarınıza / sunucunuza aktarın.
2. Gerekli kütüphaneleri (Express.js, Passport vs.) yükleyin:
   ```bash
   npm install
   ```
3. Ayar dosyasını (`.env`) kendi bilgilerinize göre oluşturun.

## ⚙️ Yapılandırma (`.env` Dosyası)

Projenizin ana dizinine bir adet `.env` dosyası oluşturun (veya mevcut `.env.example` isimli dosyayı kopyalayın).

Aşağıdaki şablonu kullanabilirsiniz:

```env
# GitHub API Entegrasyonu (Dataların Buluta Kayıt Olması İçin Zorunludur)
GITHUB_TOKEN=ghp_kendi_sifreniz_buraya
GITHUB_REPO=KullaniciAdi/RepoAdi

# GitHub OAuth Login (Yönetici Paneli Koruması İçin - Opsiyonel)
# GitHub > Developer Settings > OAuth Apps'ten uygulamanızı oluşturun.
# Authorization callback URL: http://localhost:3000/auth/github/callback
GITHUB_CLIENT_ID=olusturulan_id_buraya
GITHUB_CLIENT_SECRET=olusturulan_gizli_anahtar_buraya
ADMIN_GITHUB_USERNAME=yaso09
```
> **Not:** Eğer GitHub OAuth (CLIENT_ID vb.) anahtarlarını `.env` içine girmezseniz, sistem korumalı (admin girişli) şifre ekranını tamamen es geçer ve "npm start" dediğiniz anda arayüze anonim erişim izni verir.

## 🖥️ Kullanım

Sunucuyu ve kontrol panelini ayağa kaldırmak için terminalinize gidin ve:

```bash
npm start
```
*Veya Node.js kullanarak `node src/index.js` komutunu uygulayabilirsiniz.*

Tarayıcınızdan uygulamaya geçin:
👉 [http://localhost:3000](http://localhost:3000)

**Panelde Neler Var?**
- GitHub sunucularında mevcut olan `sorular.json`, `progress.json` ve `logs.json` dosyalarınızın son *SHA-1 Hash* kimliklerini görebilirsiniz.
- Anlık konsol kayıtları sekmesinden o saniye çekilen veya ulaşılamayan soruların durumunu inceleyebilirsiniz.
- Taramayı sonlandırabilir, daha sonra kaldığı yerden veya başarısız olan (Eski Failed) URL'lerden tekrar başlatabilirsiniz.

---  
*Geliştirilmiş kod onarımı ve modern mimarisi ile güçlü ve şık bir açık kaynak eğitim scraping projesidir.*
