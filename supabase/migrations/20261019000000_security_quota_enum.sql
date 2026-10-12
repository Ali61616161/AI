-- Ücretli Google/Gemini çağrıları için yeni kota özellikleri (enum değeri ayrı
-- işlemde eklenmeli; kullanımı bir sonraki migration'da).
alter type public.quota_feature add value if not exists 'weather';
alter type public.quota_feature add value if not exists 'trip_report';
