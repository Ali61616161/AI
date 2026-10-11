-- Çeviri merkezi kota özellikleri (değerler bir sonraki migration'da kullanılır).
alter type public.quota_feature add value if not exists 'text_translation';
alter type public.quota_feature add value if not exists 'voice_translation';
