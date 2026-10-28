-- Seyahat asistanı sohbeti için kota türü (değerler sonraki dosyada kullanılır: yeni enum değeri aynı işlemde kullanılamaz).
alter type public.quota_feature add value if not exists 'trip_chat';
