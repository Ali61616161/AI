-- Arkadaşını davet et: her kullanıcının kısa bir davet kodu olur. Yeni bir kullanıcı
-- (hesabı 30 günden yeni) bu kodu bir kez girebilir; ikisine de 7 günlük Pro verilir.
-- Ödül kayıtları 'promotional' / 'yola_referral' ürünüyle tutulur; mağaza eşitlemesi
-- bunlara dokunmaz. Bir davet edenin en fazla 20 ödülü olur (kötüye kullanımı sınırlar).

alter table public.profiles add column if not exists referral_code text unique
  check (referral_code ~ '^[A-HJ-NP-Z2-9]{6}$');

create table public.referrals (
  referred_id uuid primary key references auth.users (id) on delete cascade,
  referrer_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint referrals_not_self check (referred_id <> referrer_id)
);
create index referrals_referrer_idx on public.referrals (referrer_id);

alter table public.referrals enable row level security;
create policy referrals_select_own on public.referrals
  for select to authenticated using (referrer_id = auth.uid() or referred_id = auth.uid());
-- Ekleme sadece redeem_referral() üzerinden (security definer).
revoke insert, update, delete on public.referrals from anon, authenticated;
grant select on public.referrals to authenticated;

-- Kullanıcının davet kodu; yoksa üretir. Karışan karakterler (0, O, 1, I) kullanılmaz.
create or replace function public.my_referral_code()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select referral_code into v_code from public.profiles where id = auth.uid();
  if v_code is not null then
    return v_code;
  end if;
  loop
    select string_agg(substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1), '')
      into v_code from generate_series(1, 6);
    begin
      update public.profiles set referral_code = v_code where id = auth.uid() and referral_code is null;
      exit;
    exception when unique_violation then
      -- Çakışma: yeni kod denenir.
    end;
  end loop;
  select referral_code into v_code from public.profiles where id = auth.uid();
  return v_code;
end;
$$;
revoke execute on function public.my_referral_code() from public, anon;
grant execute on function public.my_referral_code() to authenticated;

-- Davet kodunu kullanır. Sonuç: { ok: true, days } veya { ok: false, reason }.
-- reason: invalid_code | own_code | already_redeemed | too_late | referrer_limit
create or replace function public.redeem_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_referrer uuid;
  v_created timestamptz;
  v_rewards int;
  v_until timestamptz := now() + interval '7 days';
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  select id into v_referrer from public.profiles where referral_code = upper(trim(p_code));
  if v_referrer is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;
  if v_referrer = v_me then
    return jsonb_build_object('ok', false, 'reason', 'own_code');
  end if;
  if exists (select 1 from public.referrals where referred_id = v_me) then
    return jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  end if;
  select created_at into v_created from auth.users where id = v_me;
  if v_created < now() - interval '30 days' then
    return jsonb_build_object('ok', false, 'reason', 'too_late');
  end if;
  select count(*) into v_rewards from public.referrals where referrer_id = v_referrer;

  insert into public.referrals (referred_id, referrer_id) values (v_me, v_referrer);
  insert into public.subscriptions (user_id, plan, status, store, product_id, original_transaction_id, starts_at, expires_at)
    values (v_me, 'pro_monthly', 'active', 'promotional', 'yola_referral', 'referral:' || v_me || ':new', now(), v_until);
  -- Davet edene ödül en fazla 20 kez verilir; davet edilen her durumda kazanır.
  if v_rewards < 20 then
    insert into public.subscriptions (user_id, plan, status, store, product_id, original_transaction_id, starts_at, expires_at)
      values (v_referrer, 'pro_monthly', 'active', 'promotional', 'yola_referral', 'referral:' || v_me || ':referrer', now(), v_until);
  end if;
  return jsonb_build_object('ok', true, 'days', 7, 'referrer_rewarded', v_rewards < 20);
end;
$$;
revoke execute on function public.redeem_referral(text) from public, anon;
grant execute on function public.redeem_referral(text) to authenticated;

-- Davet edilen kişi sayısı (profil ekranı).
create or replace function public.referral_count()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.referrals where referrer_id = auth.uid();
$$;
revoke execute on function public.referral_count() from public, anon;
grant execute on function public.referral_count() to authenticated;
