import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { TravelIdentity, TravelPreferences } from '@/stores/session-store';

/**
 * Seyahat tercihlerini Supabase profiline yazar. Misafir kullanıcıda veya
 * Supabase ayarlı değilse bir şey yapmaz; tercihler zaten telefonda saklanır.
 */
export async function savePreferencesToProfile(userId: string, prefs: TravelPreferences): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabase()
    .from('profiles')
    .update({
      default_companion: prefs.companion,
      default_budget: prefs.budget,
      interests: prefs.interests,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', userId);
  if (error) throw error;
}

/** Şehir merkezi ~1 km hassasiyetle saklanır (gizlilik). */
const round2 = (v: number | null) => (v === null ? null : Math.round(v * 100) / 100);

/** Vatandaşlık, ek vizeler ve yaşanan şehri profile yazar. */
export async function saveIdentityToProfile(userId: string, identity: TravelIdentity): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const { error } = await getSupabase()
    .from('profiles')
    .update({
      passport_country: identity.passport,
      other_passports: identity.otherPassports,
      extra_visas: identity.extraVisas,
      home_city: identity.homeCity,
      home_country: identity.homeCountry,
      home_lat: round2(identity.homeLat),
      home_lng: round2(identity.homeLng),
    })
    .eq('id', userId);
  if (error) throw error;
}
