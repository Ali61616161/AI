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
```

## Dizin yapısı

```
src/
├── app/            # Ekranlar (Expo Router: her dosya bir ekran)
├── components/     # brand/ (logo), ui/ (Text, Button), settings/
├── config/         # brand.json: isim, teknik kimlik, marka renkleri
├── i18n/           # Dil altyapısı ve locales/*.json çevirileri
├── lib/            # Supabase istemcisi
├── theme/          # Renk, boşluk, köşe ve yazı tokenları
└── hooks/
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
