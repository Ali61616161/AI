-- Güzergah (Routes API) çağrıları için kota türü. Enum değeri ayrı işlemde eklenmelidir.
alter type public.quota_feature add value if not exists 'route';
