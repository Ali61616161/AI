-- =============================================================================
-- Maliyet kontrolü: ücretsiz planda pahalı özellikler (yapay zekâ planı, Google Haritalar çağrıları) sıkılaştırılır;
-- ücretli planlara kötüye kullanıma karşı yüksek "adil kullanım" günlük üst sınırı konur. Normal kullanım bu sınırlara
-- yaklaşmaz; amaç kontrolsüz otomasyonun faturayı şişirmesini engellemektir.
-- =============================================================================

-- Ücretsiz: haftalık haklar.
update public.plan_limits set per_week = 1 where plan = 'free' and feature = 'itinerary_generation';
update public.plan_limits set per_week = 4 where plan = 'free' and feature in ('document_scan', 'replan');
update public.plan_limits set per_week = 2 where plan = 'free' and feature = 'trip_report';
-- Ücretsiz: günlük Google çağrıları.
update public.plan_limits set per_day = 10 where plan = 'free' and feature = 'route';
update public.plan_limits set per_day = 12 where plan = 'free' and feature = 'place_details';

-- Ücretli (Trip Pass dahil): adil kullanım günlük üst sınırı.
update public.plan_limits p set per_day = v.cap
from (values
  ('itinerary_generation', 10),
  ('replan', 40),
  ('document_scan', 30),
  ('menu_scan', 50),
  ('text_translation', 500),
  ('voice_translation', 3600),
  ('travel_info', 100),
  ('nearby_search', 200),
  ('trip_chat', 200)
) as v(feature, cap)
where p.plan in ('trip_pass', 'pro_monthly', 'pro_yearly')
  and p.feature::text = v.feature
  and p.per_day is null;
