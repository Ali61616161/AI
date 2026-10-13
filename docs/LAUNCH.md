# Yayına çıkış kontrol listesi (15. adım)

Kod yayına hazır; aşağıdakiler hesaplar ve anahtarlar bağlanınca yapılır. Anahtarları sohbete
yapıştırmayın: bulut ortamının değişkenlerine (veya EAS / Supabase sırlarına) bu adlarla ekleyin.

## 1. Supabase

| Değişken | Nereden |
|---|---|
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD` | Supabase hesabı → yeni proje |

```bash
npx supabase link --project-ref $SUPABASE_PROJECT_REF
npx supabase db push
npm run db:types
npx supabase secrets set GEMINI_API_KEY=... GOOGLE_MAPS_API_KEY=... GOOGLE_TRANSLATE_API_KEY=... \
  REVENUECAT_SECRET_KEY=... REVENUECAT_WEBHOOK_AUTH=... [AFFILIATE_*=...]
for f in parse-document generate-itinerary replan places translate travel-info trip-report subscription delete-account; do npx supabase functions deploy $f; done
npx supabase functions deploy revenuecat-webhook --no-verify-jwt
```

- Auth → Email: giriş e-postası şablonunda **kod** (`{{ .Token }}`) gösterilmeli; özel SMTP (ör. Resend, `RESEND_API_KEY`) bağlanmalı.
- Auth → URL Configuration: `yola://` yönlendirmesi.
- Storage: `documents` bucket'ı migration ile oluşur (özel).
- Realtime: `messages` ve `match_invites` yayına migration ile eklenir.

## 2. Google Cloud

| Değişken | API'ler |
|---|---|
| `GOOGLE_MAPS_API_KEY` (sunucu) | Places API (New), Weather API, Cloud Translation API, **Routes API** ("Nasıl giderim?" toplu taşıma/araba/yürüyüş güzergahı) — anahtarı bu API'lerle sınırlayın |
| `GOOGLE_MAPS_ANDROID_API_KEY` (uygulama) | Maps SDK for Android — anahtarı `com.akturangroup.yola` paketi ve imza SHA-1 ile sınırlayın |
| `GEMINI_API_KEY` | Google AI Studio |

Not: Google Places içerik saklama kuralları gereği plan kalemlerindeki puan/yorum sayısı `place_checked_at` ile tutulur; uzun süreli saklama yerine periyodik yenileme veya gösterimde canlı sorgu kararı bu adımda verilecek.

### Ulaşım ve ortaklık (affiliate) bağlantıları

Güzergahlar Google Routes API'den gelir: Google'a tarifelerini veren dünyadaki ulusal ve özel
demiryolları, bölgesel trenler, metro, tramvay, otobüs, feribot, teleferik ve fünikülerler. Her adımda
işletmecinin resmi sitesi gösterilir. Bilet bağlantıları `supabase/functions/_shared/transport.ts`
içinde araç ve bölgeye göre seçilir. Kimlik girilmeden de çalışır (Rome2rio her yer/her araç,
Google Flights uçuş), ama komisyon kazanılmaz. Ortaklık programına kabul edilince panelden alınan
"deep link" şablonu Supabase sırrı olarak eklenir. Yer tutucular: `{from} {to} {date} {adults} {lang} {from_iata} {to_iata}`.

| Sır | Ortak | Kullanıldığı yer |
|---|---|---|
| `AFFILIATE_BOOKING_URL` | Booking.com | Otel önerileri |
| `AFFILIATE_GETYOURGUIDE_URL`, `AFFILIATE_TIQETS_URL` | GetYourGuide, Tiqets | Müze/etkinlik biletleri |
| `AFFILIATE_TRAINLINE_URL`, `AFFILIATE_OMIO_URL` | Trainline, Omio | Avrupa tren/otobüs (Omio uçak da) |
| `AFFILIATE_12GO_URL` | 12Go | Asya tren, otobüs, feribot |
| `AFFILIATE_FERRYHOPPER_URL` | Ferryhopper | Avrupa feribotları |
| `AFFILIATE_BUSBUD_URL` | Busbud | Amerika ve dünya otobüsleri |
| `AFFILIATE_KIWI_URL`, `AFFILIATE_SKYSCANNER_URL` | Kiwi.com, Skyscanner | Uçuşlar |
| `AFFILIATE_DISCOVERCARS_URL` | DiscoverCars | Araç kiralama (araba ile kaçamaklar) |
| `AFFILIATE_ROME2RIO_URL` | Rome2rio | Varsayılan yedeğin yerine (isteğe bağlı) |

Şablon `https://` ile başlamalı ve en az bir yer tutucu içermelidir; aksi hâlde yok sayılır.

## 3. RevenueCat ve mağaza ürünleri

1. App Store Connect ve Play Console'da ürünler: `yola_trip_pass` (tüketilmeyen / tek seferlik), `yola_pro_monthly`, `yola_pro_yearly` (otomatik yenilenen, aynı abonelik grubunda).
2. RevenueCat: proje, iOS ve Android uygulamaları, ürünler, "pro" entitlement ve varsayılan offering (Trip Pass dahil).
3. Uygulama anahtarları (EAS ortam değişkeni): `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`.
4. Sunucu: `REVENUECAT_SECRET_KEY` (v1 secret), webhook adresi `https://<proje>.supabase.co/functions/v1/revenuecat-webhook`, Authorization değeri `REVENUECAT_WEBHOOK_AUTH`.

## 4. EAS (Expo)

```bash
npx eas-cli@latest login            # EXPO_TOKEN
npx eas-cli@latest init             # projectId app.config'e eklenir
npx expo install expo-updates       # OTA güncellemeler (projectId gerektirir)
npx eas-cli@latest env:create --environment production --name EXPO_PUBLIC_SUPABASE_URL --value ...
# aynı şekilde: EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY, EXPO_PUBLIC_REVENUECAT_*, GOOGLE_MAPS_ANDROID_API_KEY
npx eas-cli@latest build --profile development --platform all   # cihazda test
npx eas-cli@latest build --profile production --platform all
npx eas-cli@latest submit --profile production                  # eas.json → ascAppId doldurulmalı
```

## 5. Mağazalar

- Apple Developer Program ve Google Play Console hesapları (şirket adına: D-U-N-S).
- `src/config/brand.json` → `legal` bloğu (şirket, adres, e-posta) doldurulur, `npm run legal:export`, GitHub Pages açılır.
- `store/README.md`: metinler, yaş sınırı, gizlilik etiketleri, veri güvenliği formu, inceleme hesabı.
- Google Play: yeni kişisel hesaplarda 12 test kullanıcısıyla 14 gün kapalı test.

## 6. Canlı test (gerçek anahtarlarla)

- Bilet okuma (gerçek PDF/ekran görüntüsü), rota kalitesi, Planı Değiştir, mekan doğrulama doğruluğu
- Konuşma çevirisi (iOS/Android ses tanıma izinleri), kamera çevirisi
- Satın alma (sandbox) → plan değişimi, webhook, geri yükleme, iade
- Sosyal mod iki cihazla: görünürlük, davet, sohbet (Realtime), engelleme
- Çevrimdışı: uçak modunda belgeler ve plan
- Hesap silme
