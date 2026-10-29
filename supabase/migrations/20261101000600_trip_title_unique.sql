-- Aynı kullanıcı aynı adla (büyük/küçük harf ve baş/son boşluk fark etmez) ikinci bir seyahat oluşturamaz.
-- Yalnızca yeni kayıtta denetlenir; mevcut tekrarlar bozulmaz. İptal edilmiş seyahatler sayılmaz.
create or replace function public.trips_unique_title()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.trips t
    where t.owner_id = new.owner_id
      and t.status <> 'cancelled'
      and lower(btrim(t.title)) = lower(btrim(new.title))
  ) then
    raise exception 'duplicate_trip_title' using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke execute on function public.trips_unique_title() from public, anon, authenticated;

create trigger trips_unique_title before insert on public.trips
  for each row execute function public.trips_unique_title();
