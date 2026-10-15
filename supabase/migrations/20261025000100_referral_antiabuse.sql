-- Davet sistemi kötüye kullanım önlemleri:
-- 1) Cihaz: kod kullanılırken cihazın uygulamaya özel kimliği gönderilir; sadece SHA-256
--    özeti saklanır. Bir cihazda en fazla bir kez kod kullanılır ve davet edenin cihazında
--    açılan ikinci hesap onun kodunu kullanamaz.
-- 2) Davet edenin ödülü gecikmeli: davet edilen ilk planını (rota veya akşam planı)
--    oluşturunca verilir. Boş hesap açıp kod girmek davet edene bir şey kazandırmaz.

alter table public.profiles add column if not exists device_hash text;
alter table public.referrals add column if not exists device_hash text unique;
alter table public.referrals add column if not exists referrer_rewarded boolean not null default false;

create or replace function public.device_digest(p_device text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case when p_device is null or length(trim(p_device)) < 8 then null
    else encode(sha256(convert_to('yola:' || trim(p_device), 'UTF8')), 'hex') end;
$$;
revoke execute on function public.device_digest(text) from public, anon, authenticated;

drop function if exists public.my_referral_code();
create or replace function public.my_referral_code(p_device text default null)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_hash text := public.device_digest(p_device);
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_hash is not null then
    update public.profiles set device_hash = v_hash where id = auth.uid();
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
revoke execute on function public.my_referral_code(text) from public, anon;
grant execute on function public.my_referral_code(text) to authenticated;

drop function if exists public.redeem_referral(text);
-- Sonuç: { ok: true, days } veya { ok: false, reason }.
-- reason: invalid_code | own_code | already_redeemed | too_late | device_required | device_used
create or replace function public.redeem_referral(p_code text, p_device text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_referrer uuid;
  v_referrer_device text;
  v_created timestamptz;
  v_hash text := public.device_digest(p_device);
begin
  if v_me is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if v_hash is null then
    return jsonb_build_object('ok', false, 'reason', 'device_required');
  end if;
  update public.profiles set device_hash = v_hash where id = v_me;
  select id, device_hash into v_referrer, v_referrer_device from public.profiles where referral_code = upper(trim(p_code));
  if v_referrer is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid_code');
  end if;
  -- Kendi kodu veya aynı cihazdaki başka bir hesabın kodu.
  if v_referrer = v_me or v_referrer_device = v_hash then
    return jsonb_build_object('ok', false, 'reason', 'own_code');
  end if;
  if exists (select 1 from public.referrals where referred_id = v_me) then
    return jsonb_build_object('ok', false, 'reason', 'already_redeemed');
  end if;
  if exists (select 1 from public.referrals where device_hash = v_hash) then
    return jsonb_build_object('ok', false, 'reason', 'device_used');
  end if;
  select created_at into v_created from auth.users where id = v_me;
  if v_created < now() - interval '30 days' then
    return jsonb_build_object('ok', false, 'reason', 'too_late');
  end if;

  insert into public.referrals (referred_id, referrer_id, device_hash) values (v_me, v_referrer, v_hash);
  insert into public.subscriptions (user_id, plan, status, store, product_id, original_transaction_id, starts_at, expires_at)
    values (v_me, 'pro_monthly', 'active', 'promotional', 'yola_referral', 'referral:' || v_me || ':new', now(), now() + interval '7 days');
  return jsonb_build_object('ok', true, 'days', 7);
end;
$$;
revoke execute on function public.redeem_referral(text, text) from public, anon;
grant execute on function public.redeem_referral(text, text) to authenticated;

-- Davet edilen ilk planını oluşturunca davet edene 7 gün Pro (en fazla 20 ödül).
create or replace function public.reward_referrer_on_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref public.referrals%rowtype;
begin
  if new.feature not in ('itinerary_generation', 'city_plan') then
    return new;
  end if;
  select * into v_ref from public.referrals where referred_id = new.user_id and not referrer_rewarded for update;
  if not found then
    return new;
  end if;
  update public.referrals set referrer_rewarded = true where referred_id = new.user_id;
  if (select count(*) from public.referrals where referrer_id = v_ref.referrer_id and referrer_rewarded) <= 20 then
    insert into public.subscriptions (user_id, plan, status, store, product_id, original_transaction_id, starts_at, expires_at)
      values (v_ref.referrer_id, 'pro_monthly', 'active', 'promotional', 'yola_referral', 'referral:' || new.user_id || ':referrer', now(), now() + interval '7 days')
      on conflict (original_transaction_id) do nothing;
  end if;
  return new;
end;
$$;
revoke execute on function public.reward_referrer_on_activity() from public, anon, authenticated;

create trigger usage_events_reward_referrer after insert on public.usage_events
  for each row execute function public.reward_referrer_on_activity();

-- Davet sayısı: sadece ödül kazandıran (planını oluşturmuş) arkadaşlar.
create or replace function public.referral_count()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.referrals where referrer_id = auth.uid() and referrer_rewarded;
$$;
