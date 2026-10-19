// Edge Function'ların seyahat, aktif plan ve kullanıcı tercihlerini okuması.
// Kullanıcının yetkisiyle çalışan istemciyle çağrılır; RLS sadece kendi
// seyahatlerine erişmesine izin verir.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

import type { TripContext, TripReservation } from './itinerary.ts';
import type { StoredDay } from './replan.ts';

export type TripDestination = { id: string; city: string; country_code: string | null; lat: number | null; lng: number | null };

export type LoadedTrip = {
  id: string;
  title: string;
  startDate: string | null;
  endDate: string | null;
  ctx: TripContext;
  reservations: TripReservation[];
  destinations: TripDestination[];
  activePlan: { id: string; days: StoredDay[] } | null;
};

const TRIP_SELECT =
  'id, title, start_date, end_date, companion_type, budget_tier, interests, adults, children, budget_currency, budget_amount, local_transport, notes, arrival_time, departure_time, arrival_airport, departure_airport, ' +
  'trip_destinations(id, city, country_code, arrive_on, depart_on, position, lat, lng), ' +
  'reservations(id, type, title, starts_at, ends_at, start_timezone, end_timezone, origin_name, destination_name, address, is_cancelled)';

const PLAN_SELECT =
  'id, day_plans(date, city, title, notes, plan_items(position, kind, title, description, starts_at, ends_at, timezone, ' +
  'place_name, address, category, estimated_cost, cost_currency, priority, is_indoor, is_locked, reservation_id, affiliate_partner, ' +
  'booking_url, google_place_id, lat, lng, rating, rating_count, maps_url, place_status, place_checked_at, status))';

export async function loadProfile(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('profiles').select('preferred_language, home_currency').eq('id', userId).single();
  return { language: data?.preferred_language ?? 'en', currency: data?.home_currency ?? 'EUR' };
}

/** Kullanıcının önceki seyahat raporlarından çıkarılan tercihler (en yeni 5). */
export async function loadPastInsights(supabase: SupabaseClient, excludeTripId: string): Promise<{ liked?: string[]; disliked?: string[] }[]> {
  const { data } = await supabase
    .from('trip_reports')
    .select('ai_insights')
    .neq('trip_id', excludeTripId)
    .not('ai_insights', 'is', null)
    .order('generated_at', { ascending: false })
    .limit(5);
  return (data ?? []).map((r: { ai_insights: { liked?: string[]; disliked?: string[] } }) => r.ai_insights);
}

/** Seyahati düzenleyebilen kullanıcı için yükler; yoksa veya yetki yoksa null. */
export async function loadTrip(supabase: SupabaseClient, tripId: string, profile: { language: string; currency: string }): Promise<LoadedTrip | null> {
  const { data: trip } = await supabase.from('trips').select(TRIP_SELECT).eq('id', tripId).maybeSingle();
  if (!trip) return null;
  const { data: canEdit } = await supabase.rpc('can_edit_trip', { p_trip_id: tripId });
  if (!canEdit) return null;

  // deno-lint-ignore no-explicit-any
  const t = trip as any;
  const reservations: TripReservation[] = (t.reservations ?? []).filter((r: { is_cancelled: boolean }) => !r.is_cancelled);

  const { data: plan } = await supabase.from('plan_versions').select(PLAN_SELECT).eq('trip_id', tripId).eq('is_active', true).maybeSingle();
  // deno-lint-ignore no-explicit-any
  const p = plan as any;

  return {
    id: t.id,
    title: t.title,
    startDate: t.start_date,
    endDate: t.end_date,
    reservations,
    destinations: [...(t.trip_destinations ?? [])].sort((a, b) => a.position - b.position),
    activePlan: p ? { id: p.id, days: [...p.day_plans].sort((a: StoredDay, b: StoredDay) => a.date.localeCompare(b.date)) } : null,
    ctx: {
      language: profile.language,
      start_date: t.start_date,
      end_date: t.end_date,
      companion: t.companion_type,
      budget: t.budget_tier,
      interests: t.interests ?? [],
      adults: t.adults,
      children: t.children,
      currency: t.budget_currency ?? profile.currency,
      local_transport: t.local_transport ?? 'mixed',
      notes: typeof t.notes === 'string' ? t.notes : null,
      arrival_time: typeof t.arrival_time === 'string' ? t.arrival_time.slice(0, 5) : null,
      departure_time: typeof t.departure_time === 'string' ? t.departure_time.slice(0, 5) : null,
      arrival_airport: typeof t.arrival_airport === 'string' ? t.arrival_airport : null,
      departure_airport: typeof t.departure_airport === 'string' ? t.departure_airport : null,
      daily_budget: t.budget_amount === null || t.budget_amount === undefined ? null : Number(t.budget_amount),
      destinations: [...(t.trip_destinations ?? [])].sort((a, b) => a.position - b.position),
      reservations,
    },
  };
}
