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
| Fotoğraflar | Evet (bilet, menü) | Evet | Hayır | Uygulama işlevi |
| Ses verisi | Hayır (konuşma telefonda yazıya dökülür; sunucuya sadece metin gider) | — | — | — |
| Diğer kullanıcı içeriği (mesajlar, seyahatler, notlar) | Evet | Evet | Hayır | Uygulama işlevi |
| Satın alma geçmişi | Evet | Evet | Hayır | Uygulama işlevi |
| Kullanıcı kimliği | Evet | Evet | Hayır | Uygulama işlevi |
| Reklam / izleme verisi | Hayır | — | — | — |

## Google Play veri güvenliği (Data safety)

- Veri toplanıyor ve aktarım sırasında şifreleniyor: **Evet**
- Kullanıcı veri silme isteyebilir: **Evet** (uygulama içinde Profil → Hesabı sil; ayrıca web: gizlilik politikasındaki e-posta)
- Toplananlar: e-posta, ad, kullanıcı kimliği; hassas ve yaklaşık konum; fotoğraflar; uygulama içi mesajlar; diğer kullanıcı içeriği; satın alma geçmişi
- Paylaşım: hizmet sağlayıcılarla (Supabase, Google, RevenueCat) — Play tanımına göre "paylaşım" sayılmaz
- Reklam: Hayır

## Ekran görüntüleri

Gerekli boyutlar: iPhone 6,9" (1320×2868) ve 6,5" (1284×2778), iPad 13" (2064×2752, `supportsTablet: true` olduğu için); Android telefon (en az 1080×1920) ve 7"/10" tablet (isteğe bağlı).
Önerilen sıra: 1) Gün gün rota 2) Planı Değiştir 3) Bilet yükleme 4) Canlı çeviri 5) Yakında açık + harita 6) Çevrimdışı 7) Seyahat raporu 8) Araçlar.
Gerçek cihaz/simülatör görüntüleri 15. adımda geliştirme derlemesiyle alınacak.
