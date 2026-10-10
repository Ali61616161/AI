import { useEffect } from 'react';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

/** Supabase oturumunu dinleyip store'a aktarır. Kök layout'ta bir kez çağrılır. */
export function useAuthListener(): void {
  const setSession = useSessionStore((s) => s.setSession);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => data.subscription.unsubscribe();
  }, [setSession]);
}
