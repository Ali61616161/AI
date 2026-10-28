# Mağaza hazırlığı

Bu klasör App Store ve Google Play başvurusu için gereken metinleri ve cevapları içerir.
Metinler `python3 store/build-metadata.py` ile üretilir (karakter sınırları otomatik kontrol edilir).

## Sayfa metinleri

| Alan | App Store | Google Play |
|---|---|---|
| Ad (30) | `app-store/<dil>/name.txt` | `google-play/<dil>/title.txt` |
| Alt başlık (30) / kısa açıklama (80) | `subtitle.txt` | `short_description.txt` |
| Anahtar kelimeler (100) | `keywords.txt` | — |
| Tanıtım metni (170) | `promotional_text.txt` | — |
| Açıklama (4000) | `description.txt` | `full_description.txt` |

Diller: Türkçe, İngilizce, İspanyolca, Fransızca, Almanca, İtalyanca, Rusça, Arapça, Çince (Basitleştirilmiş).
Uygulama adı ve iOS izin metinleri cihaz diline göre gösterilir (`assets/locales/*.json`).

## Yasal sayfalar

`npm run legal:export` gizlilik politikası ve kullanım koşullarını `docs/` altına üretir.
GitHub → Settings → Pages → "Deploy from a branch: main /docs" ile yayınlanabilir:

- Gizlilik: `https://ali61616161.github.io/AI/privacy/` (Türkçe: `/privacy/tr/`)
- Koşullar: `https://ali61616161.github.io/AI/terms/` (Türkçe: `/terms/tr/`)

Yayından önce `src/config/brand.json` → `legal` bloğundaki şirket unvanı, adres ve e-postalar doldurulmalı ve `npm run legal:export` tekrar çalıştırılmalıdır.

## İnceleme hesabı (App Review / Play)

Giriş e-posta koduyla yapılır; inceleme ekibi kod alamayacağı için **şifreyle giriş** de vardır
(giriş ekranı → "Şifreyle giriş yap"). Supabase panelinde bir inceleme kullanıcısı oluşturun
(Authentication → Users → Add user → e-posta + şifre, "Auto confirm"), onboarding'i tamamlayın
ve örnek bir seyahat ekleyin. Bilgileri App Store Connect → App Review Information ve
Play Console → App access bölümüne yazın.

İnceleme notu önerisi (İngilizce):

> Sign in on the first screen with "Sign in with a password" using the demo account below. A sample trip to Rome is already added: open it to see the AI itinerary, "Change the plan" (AI assistant button in the tab bar), translation (Translate in the assistant), offline mode and the trip report. Social mode requires age 18+ and shows other travelers only nearby; you can block/report from any chat. Purchases use the standard StoreKit / Play Billing sandbox. Account deletion: Profile → Delete account.

## Yaş sınırı

- **App Store:** Kullanıcılar arası iletişim ve tanımadığı kişilerle buluşma (sosyal mod) nedeniyle 17+ önerilir. Anketteki "kullanıcı tarafından oluşturulan içerik / iletişim" sorularına "evet"; şiddet, kumar, tıbbi tedavi vb. "hayır".
- **Google Play (IARC):** Kullanıcılar etkileşime girebilir: evet; konum paylaşımı: evet (yaklaşık); dijital satın alma: evet.

## App Store gizlilik etiketi (App Privacy)

| Veri türü | Toplanıyor | Kullanıcıya bağlı | İzleme | Amaç |
|---|---|---|---|---|
| E-posta adresi | Evet | Evet | Hayır | Uygulama işlevi, hesap |
| Ad (görünen ad) | Evet (sosyal mod) | Evet | Hayır | Uygulama işlevi |
| Hassas konum | Evet (yakında açık yerler, Planı Değiştir) | Evet | Hayır | Uygulama işlevi |
| Yaklaşık konum | Evet (sosyal mod) | Evet | Hayır | Uygulama işlevi |
| Fotoğraflar | Evet (bilet, menü, seyahat günlüğü) | Evet | Hayır | Uygulama işlevi |
| Ses verisi | Hayır (konuşma telefonda yazıya dökülür; sunucuya sadece metin gider) | — | — | — |
| Diğer kullanıcı içeriği (mesajlar, seyahatler, notlar, gezilen ülkeler, kaydedilen mekanlar) | Evet | Evet | Hayır | Uygulama işlevi |
| Diğer veri: vatandaşlık/pasaport ülkesi, ek vize türleri, belge son kullanma tarihleri, Schengen giriş-çıkış tarihleri, yaşanan şehir (belge numarası alınmaz) | Evet | Evet | Hayır | Uygulama işlevi |
| Satın alma geçmişi | Evet | Evet | Hayır | Uygulama işlevi |
| Kullanıcı kimliği | Evet | Evet | Hayır | Uygulama işlevi |
| Cihaz kimliği (reklam kimliği, IDFA) — sadece ücretsiz sürüm, AdMob | Evet | Hayır | **Evet** (kullanıcı Apple takip iznini verirse) | Üçüncü taraf reklam |
| Ürün etkileşimi / reklam verisi (gösterim, tıklama) — AdMob | Evet | Hayır | **Evet** | Üçüncü taraf reklam, analiz |
| Yaklaşık konum (IP üzerinden) — AdMob | Evet | Hayır | **Evet** | Üçüncü taraf reklam |

Uygulama Apple takip izni (ATT) penceresini gösterdiği için "Bu uygulama sizi izlemek için veri kullanıyor mu?" sorusuna **Evet** denmelidir; aksi hâlde inceleme 5.1.2 gerekçesiyle reddedilir. Belge numarası hiçbir yerde toplanmaz.

## Google Play veri güvenliği (Data safety)

- Veri toplanıyor ve aktarım sırasında şifreleniyor: **Evet**
- Kullanıcı veri silme isteyebilir: **Evet** (uygulama içinde Profil → Hesabı sil; ayrıca web: gizlilik politikasındaki e-posta)
- Toplananlar: e-posta, ad, kullanıcı kimliği; hassas ve yaklaşık konum; fotoğraflar; uygulama içi mesajlar; diğer kullanıcı içeriği (seyahatler, gezilen ülkeler, vatandaşlık ve vize türleri, belge son kullanma tarihleri); satın alma geçmişi; **cihaz veya diğer kimlikler (reklam kimliği)**; **uygulama etkileşimleri**
- Paylaşım: hizmet sağlayıcılarla (Supabase, Google, RevenueCat) — Play tanımına göre "paylaşım" sayılmaz. **Reklam kimliği ve uygulama etkileşimleri Google AdMob ile "Reklam veya pazarlama" amacıyla paylaşılır.**
- Play Console → Uygulama içeriği → **Reklamlar: "Evet, uygulamamda reklam var"**; **Reklam kimliği: "Evet", amaç: Reklam veya pazarlama** (Android 13+ için `AD_ID` izni AdMob tarafından eklenir)

## Ekran görüntüleri

Gerekli boyutlar: iPhone 6,9" (1320×2868) ve 6,5" (1284×2778), iPad 13" (2064×2752, `supportsTablet: true` olduğu için); Android telefon (en az 1080×1920) ve 7"/10" tablet (isteğe bağlı).
Önerilen sıra (en çok 10): 1) Gün gün rota 2) Şehrim: bu akşam ne yapsak? 3) Planı Değiştir 4) Pasaportum (pasaport gücü) 5) Gezdiğim ülkeler (dünya yüzdesi) 6) Canlı çeviri 7) Çarkı çevir 8) Kaçamaklar 9) Bilet yükleme 10) Schengen 90/180.

Hazır görüntüler (9 dil × 10 ekran, bu sırayla `NN-<ad>.png`):

| Klasör | Boyut | Yükleneceği yer |
| --- | --- | --- |
| `screenshots/ios-6.9/<ASC dili>/` | 1320×2868 | App Store Connect → iPhone 6,9" (6,5" için de kullanılabilir; ASC küçültür) |
| `screenshots/ipad-13/<ASC dili>/` | 2064×2752 | App Store Connect → iPad 13" |
| `screenshots/android-phone/<Play dili>/` | 1080×1920 | Play Console → Telefon ekran görüntüleri |

Dil klasörleri `app-store/` ve `google-play/` altındakilerle aynı adı taşır (ör. ASC `zh-Hans`, Play `zh-CN`).

Yeniden üretmek (görüntüler uygulamanın gerçek web derlemesinden alınır):

```bash
# 1) Yerel test yığını (Postgres + PostGIS, PostgREST, Edge Function'lar, sahte Gemini/Google)
POSTGREST_BIN=/yol/postgrest PGHOST=127.0.0.1 PGPORT=54329 PGUSER=postgres FAKE_GEMINI=1 DEV_DB=yola_shots scripts/local-stack/start.sh
# 2) Demo kullanıcıyı yazar, web derlemesini alır, görüntüleri çeker ve birleştirir (~25 dk)
LOG_DIR=<start.sh çıktısındaki klasör> PGHOST=127.0.0.1 PGPORT=54329 PGUSER=postgres DEV_DB=yola_shots node store/screenshots/make.mjs
#    Seçenekler: --langs tr,en  --devices ios,ipad,android  --screens 1,5  --dist <hazır web derlemesi>
```

- Betik sadece yerel yığına bağlanır (`localhost`); anahtarlar ortam değişkeni olarak verilir, dosyaya yazılmaz. `DEV_DB` veritabanındaki demo kullanıcı (`demo@yola.app`, Pro) her çalıştırmada silinip yeniden yazılır.
- Başlıklar `make.mjs` içindeki `CAPTIONS` tablosunda; AI'ın üreteceği demo içerik (Roma rotası, İstanbul akşam planı, kaçamaklar, "Planı Değiştir" cevabı, çeviri konuşması) `content.mjs` içinde, 9 dilde. Uygulama metinleri dil dosyalarından gelir.
- PNG'ler `pngquant` ile sıkıştırılır (PATH'te yoksa `npx -p pngquant-bin` ile geçici indirilir).
- `screenshots/fonts/`: başlık yazı tipleri (Noto Kufi Arabic, Noto Sans SC alt kümesi; SIL Open Font License). Çince başlıklar değişirse alt küme yeniden indirilmelidir (Google Fonts `text=` parametresi).
