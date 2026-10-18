-- Seyahate özel sorular: şehir içi ulaşım türü (araba / toplu taşıma / karışık) ve kullanıcının
-- seyahatini anlattığı serbest not (en fazla 1000 karakter). AI planı bunlara göre şekillenir.
alter table public.trips
  add column local_transport text not null default 'mixed' check (local_transport in ('transit', 'car', 'mixed')),
  add column notes text check (notes is null or char_length(notes) <= 1000);

comment on column public.trips.local_transport is 'Şehir içinde nasıl gezilecek: transit (toplu taşıma), car (araba), mixed (karışık/belirsiz).';
comment on column public.trips.notes is 'Kullanıcının seyahatini anlattığı serbest not (en fazla 1000 karakter); plan istemine tercih olarak girer.';
comment on column public.trips.budget_amount is 'Kişi başı günlük bütçe (budget_currency cinsinden). Doluysa AI planı budget_tier yerine bunu kullanır.';
