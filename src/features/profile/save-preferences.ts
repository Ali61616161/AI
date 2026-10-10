import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import type { TravelPreferences } from '@/stores/session-store';

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
