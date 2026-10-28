-- Yapıştırılan rezervasyon e-postası düz metin olarak belge kovasına yüklenir.
update storage.buckets
set allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'text/plain']
where id = 'documents';
