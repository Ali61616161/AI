# Yola

**Yola: AI Travel Planner.** Bütçene, yol arkadaşlarına ve anlık duruma (hava, konum, saat) göre rota çizen, çevrimdışı da çalışan yapay zeka destekli seyahat asistanı.

## Teknoloji

| Katman | Seçim |
|---|---|
| Uygulama | Expo SDK 57, React Native, TypeScript, Expo Router |
| Veri yönetimi | Zustand, TanStack Query |
| Backend | Supabase (Postgres + PostGIS, Auth, Realtime, Edge Functions) |
| Çok dil | i18next + expo-localization, 9 dil, Arapça için RTL |

## Kurulum

```bash
npm install
cp .env.example .env.local   # Supabase bilgilerini doldurun
npm start
```

## Komutlar

```bash
npm run lint            # ESLint
npm run typecheck       # TypeScript
npm run check:locales   # 9 dil dosyasında eksik çeviri anahtarı var mı
npm run db:test         # Şemayı boş bir PostgreSQL + PostGIS'e uygulayıp testleri çalıştırır
npm run db:types        # Bağlı Supabase projesinden TypeScript tiplerini yeniden üretir
npm run functions:check # Edge Function'ları Deno ile tip ve lint kontrolünden geçirir
npm run functions:test  # Paylaşılan modüllerin birim testleri (Deno)
npm run preview:web     # Tek dosyalık web önizlemesi üretir (dist-preview/yola-preview.html)
```

## Edge Functions

| Fonksiyon | Görev | Gerekli sırlar |
|---|---|---|
| `parse-document` | Yüklenen bilet/otel belgesini Gemini ile okur, `documents` tablosuna yazar | `GEMINI_API_KEY`, isteğe bağlı `GEMINI_MODEL` |
| `replan` | "Planı Değiştir": konum ve saate göre günün kalanını yeniden planlar; tarih değişince planı yeni tarihlere uyarlar | `GEMINI_API_KEY`, isteğe bağlı `GEMINI_MODEL` |
| `generate-itinerary` | Bütçe, yol arkadaşı ve ilgi alanlarına göre gün gün rota üretir; rezervasyonlar kilitli durak olur; mekanları Google Places ile doğrular; yeni plan sürümü kaydeder (ücretsiz planda ilk 3 gün) | `GEMINI_API_KEY`, isteğe bağlı `GEMINI_MODEL`, `GOOGLE_MAPS_API_KEY` |
| `translate` | Çeviri merkezi: metin (Cloud Translation), konuşma çevirisi (konuşma telefonda yazıya dökülür, saniyeyle kota), kamerayla menü/tabela (Gemini) | `GOOGLE_TRANSLATE_API_KEY` (yoksa `GOOGLE_MAPS_API_KEY`), `GEMINI_API_KEY` |
| `travel-info` | Pasaport ve varış ülkesine göre vize ve giriş koşulları (genel bilgi, resmi kaynaktan doğrulanmalı) | `GEMINI_API_KEY` |
| `trip-report` | Seyahat sonrası rapor: istatistikler, mekan puanları, AI özeti; beğeni/beğenmeme çıkarımları sonraki rotalara yansır | `GEMINI_API_KEY` (yoksa sadece istatistik) |
| `subscription` | Satın alma sonrası RevenueCat REST'ten doğrulayarak Pro aboneliği günceller; Trip Pass'i seyahate bağlar | `REVENUECAT_SECRET_KEY` |
| `revenuecat-webhook` | RevenueCat olayları (satın alma, yenileme, iptal, iade, süre sonu) → `subscriptions` | `REVENUECAT_WEBHOOK_AUTH` |
| `delete-account` | Hesabı ve tüm verileri kalıcı olarak siler (App Store / Play hesap silme şartı) | `SUPABASE_SERVICE_ROLE_KEY` |
| `places` | Yakında şu an açık yerler, bütçeye göre otel önerileri (Booking bağlantısıyla), seyahat günlerinin hava tahmini | `GOOGLE_MAPS_API_KEY` |

`GOOGLE_MAPS_API_KEY` için Google Cloud'da **Places API (New)** ve **Weather API** açık olmalıdır. Anahtar yoksa rota yine üretilir, sadece mekan doğrulama ve anlık hava atlanır. Google'a gönderilen her alan, resmi discovery şemasının alt kümesi olan `supabase/functions/_shared/google/schema.json` ile testlerde doğrulanır (`python3 scripts/update-google-schema.py` ile güncellenir).

İsteğe bağlı ortaklık (affiliate) bağlantı şablonları: `AFFILIATE_BOOKING_URL`, `AFFILIATE_GETYOURGUIDE_URL`, `AFFILIATE_TIQETS_URL` (yer tutucular: `{query}`, `{city}`, `{checkin}`, `{checkout}`, `{adults}`, `{children}`, `{lang}`; ayrıntı `_shared/affiliate.ts`). Verilmezse ortaklık kimliği olmayan düz arama bağlantıları kullanılır.

Harita: iOS'ta Apple Haritalar (anahtar gerekmez). Android'de Google Haritalar için Android uygulamasına kısıtlı ayrı bir anahtar EAS ortam değişkeni `GOOGLE_MAPS_ANDROID_API_KEY` olarak verilir. Web'de harita yerine rotayı Google Haritalar'da açan kart gösterilir.

Uygulama ile fonksiyonların paylaştığı kod `supabase/functions/_shared/` altındadır (dış paket kullanmaz). Dağıtım:

```bash
npx supabase secrets set GEMINI_API_KEY=... GOOGLE_MAPS_API_KEY=...
npx supabase functions deploy parse-document
npx supabase functions deploy generate-itinerary
npx supabase functions deploy replan
npx supabase functions deploy places
npx supabase functions deploy translate
npx supabase functions deploy travel-info
npx supabase functions deploy trip-report
npx supabase functions deploy subscription
npx supabase functions deploy revenuecat-webhook --no-verify-jwt
npx supabase functions deploy delete-account
```

## Abonelik (RevenueCat)

Ürünler: `yola_trip_pass` (tek seferlik, bir seyahat), `yola_pro_monthly`, `yola_pro_yearly` (otomatik yenilenen). Kimlikler `RC_PRODUCT_*` ortam değişkenleriyle değiştirilebilir. Uygulama RevenueCat'e Supabase kullanıcı kimliğiyle giriş yapar; abonelik durumu sadece sunucuda yazılır (kullanıcı `subscriptions` tablosuna yazamaz). Uygulamadaki herkese açık anahtarlar: `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`. Satın alma mağaza bağlantısı gerektirdiği için Expo Go'da değil, geliştirme derlemesinde çalışır.

## Mağaza ve yayın

- `store/`: 9 dilde App Store ve Google Play sayfa metinleri (`python3 store/build-metadata.py`), yaş sınırı, gizlilik etiketi ve veri güvenliği cevapları, inceleme hesabı notları
- `docs/`: gizlilik politikası ve kullanım koşulları web sayfaları (`npm run legal:export`, GitHub Pages ile yayınlanabilir)
- `eas.json`: development, preview ve production derleme profilleri
- `docs/LAUNCH.md`: anahtarlar bağlanırken izlenecek adımlar

## Yerel test ortamı

Supabase projesi olmadan uygulamayı gerçek sorgularla denemek için: PostgreSQL + PostGIS, [PostgREST](https://postgrest.org) ve Deno gerekir.

```bash
POSTGREST_BIN=/yol/postgrest PGHOST=/tmp PGPORT=5432 PGUSER=postgres scripts/local-stack/start.sh generate-itinerary
```

Betik boş bir `yola_dev` veritabanına migration'ları uygular; PostgREST'i, tüm Edge Function'ları (`functions-router.ts`) ve Supabase adreslerini taklit eden geçidi (`gateway.mjs`) başlatır, uygulamanın kullanacağı `EXPO_PUBLIC_*` değerlerini yazdırır. Girişte her e-posta kabul edilir, kod `123456`'dır. Durdurmak için `LOG_DIR=... scripts/local-stack/stop.sh`. Sadece yerel geliştirme içindir.

`FAKE_GEMINI=1` verilirse Gemini ve Google Places/Weather yerine öngörülebilir cevap veren test ikizleri (`fake-gemini.mjs`, `fake-google.mjs`) kullanılır; Google ikizi istekleri resmi şemayla doğrular ve bilinmeyen alana 400 döner. Uçtan uca test bu modda çalışır ve CI'da her push'ta koşar:

```bash
SUPABASE_URL=http://localhost:54321 ANON_KEY=$(cat $LOG_DIR/anon-key) npm run e2e:local   # 8 senaryo, 54 adım
```

## Veritabanı (Supabase)

Şema `supabase/migrations/` altındadır. Tüm tablolarda satır düzeyinde güvenlik (RLS) açıktır.

İlk kurulum:

```bash
npx supabase login
npx supabase link --project-ref <proje-ref>
npx supabase db push        # migration'ları uygular
npm run db:types            # tipleri günceller
```

`npm run db:test` için yerelde PostGIS'li bir PostgreSQL gerekir (`PGHOST`, `PGPORT`, `PGUSER` ile ayarlanır). Aynı testler GitHub Actions'ta her push'ta çalışır.

## Dizin yapısı

```
src/
├── app/            # Ekranlar (Expo Router: her dosya bir ekran)
├── components/     # brand/ (logo), ui/ (Text, Button), settings/
├── config/         # brand.json: isim, teknik kimlik, marka renkleri
├── i18n/           # Dil altyapısı ve locales/*.json çevirileri
├── lib/            # Supabase istemcisi
├── theme/          # Renk, boşluk, köşe ve yazı tokenları
├── types/          # database.ts: şemadan üretilen tipler
└── hooks/
supabase/
├── migrations/     # SQL şeması
└── config.toml
tests/db/           # Şema testleri
assets/
├── brand/          # Logo kaynak dosyası (SVG)
└── images/         # Uygulama ikonu, açılış ekranı, favicon
```

## Marka

İsim, mağaza adı, bundle id ve marka renkleri yalnızca `src/config/brand.json` dosyasındadır. `app.config.ts` ve uygulama kodu buradan okur.

## Çeviri ekleme

1. Yeni anahtarı önce `src/i18n/locales/en.json` dosyasına ekleyin (tipler buradan üretilir).
2. Aynı anahtarı diğer 8 dil dosyasına ekleyin.
3. `npm run check:locales` ile kontrol edin.
