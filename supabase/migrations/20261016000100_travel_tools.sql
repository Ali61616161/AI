-- =============================================================================
-- Seyahat araçları: harcama ve hesap bölüşme, vize bilgisi kotası.
-- =============================================================================

insert into public.plan_limits (plan, feature, per_trip, per_day) values
  ('free', 'travel_info', null, 5),
  ('trip_pass', 'travel_info', null, null),
  ('pro_monthly', 'travel_info', null, null),
  ('pro_yearly', 'travel_info', null, null)
on conflict (plan, feature) do nothing;

-- Yol arkadaşı uygulamayı kullanmıyor olabilir; ödeyen kişi isimle de tutulur.
alter table public.expenses
  add column paid_by_name text check (char_length(paid_by_name) between 1 and 60);

-- Harcamayı ve eşit paylarını tek işlemde ekler. p_participants boşsa harcama
-- bölüşülmez (sadece kaydedilir). Tutarlar bütçe para birimine çevrilmiş olarak
-- paylaştırılır; kur bilinmiyorsa harcamanın kendi para birimi kullanılır.
create or replace function public.add_expense(
  p_trip_id uuid,
  p_amount numeric,
  p_currency char(3),
  p_amount_in_budget_currency numeric,
  p_category public.expense_category,
  p_description text,
  p_paid_by_name text,
  p_participants text[] default '{}'
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_total numeric;
  v_cents bigint;
  v_base bigint;
  v_extra bigint;
  v_names text[];
  i integer;
begin
  if not public.can_edit_trip(p_trip_id) then
    raise exception 'trip not found or not editable' using errcode = '42501';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;

  insert into public.expenses (trip_id, amount, currency, amount_in_budget_currency, category, description, paid_by_name)
  values (p_trip_id, round(p_amount, 2), upper(p_currency), round(p_amount_in_budget_currency, 2), p_category,
          nullif(left(trim(p_description), 200), ''), nullif(left(trim(p_paid_by_name), 60), ''))
  returning id into v_id;

  select array_agg(distinct n) into v_names
    from unnest(coalesce(p_participants, '{}')) as t(n)
    where nullif(trim(n), '') is not null;

  if v_names is not null and array_length(v_names, 1) > 0 then
    v_total := coalesce(p_amount_in_budget_currency, p_amount);
    v_cents := round(v_total * 100);
    v_base := v_cents / array_length(v_names, 1);
    v_extra := v_cents - v_base * array_length(v_names, 1);
    for i in 1 .. array_length(v_names, 1) loop
      insert into public.expense_shares (expense_id, participant_name, share_amount)
      values (v_id, left(trim(v_names[i]), 60), (v_base + case when i <= v_extra then 1 else 0 end) / 100.0);
    end loop;
  end if;
  return v_id;
end;
$$;

revoke execute on function public.add_expense(uuid, numeric, char, numeric, public.expense_category, text, text, text[]) from public, anon;
grant execute on function public.add_expense(uuid, numeric, char, numeric, public.expense_category, text, text, text[]) to authenticated;
