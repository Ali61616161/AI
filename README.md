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

Uygulama ile fonksiyonların paylaştığı kod `supabase/functions/_shared/` altındadır (dış paket kullanmaz). Dağıtım:

```bash
npx supabase secrets set GEMINI_API_KEY=...
npx supabase functions deploy parse-document
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
