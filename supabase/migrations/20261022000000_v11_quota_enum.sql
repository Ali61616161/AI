-- v1.1 (Şehrim, Kaçamak, Çark) kota özellikleri. Enum değerleri ayrı migration'da
-- eklenir; aynı işlemde kullanılamazlar.
alter type public.quota_feature add value if not exists 'city_plan';
alter type public.quota_feature add value if not exists 'getaway';
alter type public.quota_feature add value if not exists 'spin';
