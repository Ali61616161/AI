-- Mekân kartı (Google Places ayrıntıları + fotoğraflar) için kota türü. Enum değeri ayrı işlemde eklenmelidir.
alter type public.quota_feature add value if not exists 'place_details';
