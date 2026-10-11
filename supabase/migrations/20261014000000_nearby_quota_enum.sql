-- Yeni kota özelliği. Postgres yeni enum değerinin aynı işlemde kullanılmasına izin
-- vermediği için ayrı migration'dadır; limitler bir sonraki dosyada eklenir.
alter type public.quota_feature add value if not exists 'nearby_search';
