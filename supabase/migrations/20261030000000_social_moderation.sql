-- =============================================================================
-- Gezginler moderasyonu: şikayetle otomatik askıya alma, şikayet ve mesaj hız sınırları.
-- =============================================================================

-- Askıdaki kullanıcılar. İstemci okuyamaz/yazamaz (politika yok); yalnızca aşağıdaki tetikleyiciler ve
-- destek (service_role) yönetir. Böylece kullanıcı kendi askısını kaldıramaz.
create table public.social_suspensions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  suspended_until timestamptz not null,
  reason text not null default 'reports',
  created_at timestamptz not null default now()
);
alter table public.social_suspensions enable row level security;

-- Görünür olmak için askıda olmamak da gerekir.
create or replace function public.social_profiles_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles%rowtype;
begin
  select * into v_profile from public.profiles where id = new.user_id;
  if new.is_visible then
    if exists (select 1 from public.social_suspensions s where s.user_id = new.user_id and s.suspended_until > now()) then
      raise exception 'social mode is suspended' using errcode = '42501', hint = 'suspended';
    end if;
    if v_profile.birth_year is null or extract(year from now())::int - v_profile.birth_year < 18 then
      raise exception 'social mode requires age 18+' using errcode = '42501', hint = 'age_required';
    end if;
    if v_profile.display_name is null or char_length(trim(v_profile.display_name)) = 0 then
      raise exception 'social mode requires a display name' using errcode = '23514', hint = 'name_required';
    end if;
  end if;
  return new;
end;
$$;

-- Aynı kullanıcı son 30 günde 3 farklı kişiden şikayet alırsa 14 gün askıya alınır: görünmez olur, bekleyen
-- ve kabul edilmiş davetleri iptal edilir. Tekrar şikayet eden aynı kişi sayıyı artırmaz.
create or replace function public.user_reports_auto_suspend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (
    select count(distinct r.reporter_id)
    from public.user_reports r
    where r.reported_id = new.reported_id and r.created_at > now() - interval '30 days'
  ) >= 3 then
    insert into public.social_suspensions (user_id, suspended_until)
    values (new.reported_id, now() + interval '14 days')
    on conflict (user_id) do update set suspended_until = greatest(public.social_suspensions.suspended_until, excluded.suspended_until);

    update public.social_profiles set is_visible = false where user_id = new.reported_id and is_visible;
    update public.match_invites
      set status = 'cancelled', responded_at = now()
      where status in ('pending', 'accepted') and new.reported_id in (from_user, to_user);
  end if;
  return new;
end;
$$;

create trigger user_reports_auto_suspend after insert on public.user_reports
  for each row execute function public.user_reports_auto_suspend();

-- Şikayet sistemi kötüye kullanılmasın: bir kullanıcı günde en fazla 20 şikayet gönderebilir.
create or replace function public.user_reports_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.user_reports r where r.reporter_id = new.reporter_id and r.created_at > now() - interval '1 day') >= 20 then
    raise exception 'too many reports' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end;
$$;

create trigger user_reports_rate_limit before insert on public.user_reports
  for each row execute function public.user_reports_rate_limit();

-- Mesaj taşkınlığı: bir kullanıcı dakikada en fazla 20 mesaj gönderebilir.
create or replace function public.messages_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select count(*) from public.messages m where m.sender_id = new.sender_id and m.created_at > now() - interval '1 minute') >= 20 then
    raise exception 'too many messages' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  return new;
end;
$$;

create trigger messages_rate_limit before insert on public.messages
  for each row execute function public.messages_rate_limit();
