-- Gemi / feribot rezervasyonu: tren ve otobüs gibi yolculuk türü olarak saklanır.
alter type public.reservation_type add value if not exists 'ferry';
