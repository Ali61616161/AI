import { useEffect } from 'react';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import { resetLocalUserData } from './reset-local-data';

/**
 * Supabase oturumunu dinleyip store'a aktarır. Kök layout'ta bir kez çağrılır.
 * - Oturum süresi dolmuş ve internet yokken `getSession` boş döner; bu çıkış sayılmaz (kullanıcı `userId` ile içeride kalır).
 * - Yalnızca gerçek çıkışta ya da başka hesaba geçişte telefondaki kişisel veriler silinir.
 */
export function useAuthListener(): void {
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabase();

    const apply = async (session: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session']) => {
      const store = useSessionStore.getState();
      if (session && store.userId && store.userId !== session.user.id) await resetLocalUserData();
      useSessionStore.getState().setSession(session);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) apply(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        resetLocalUserData();
        return;
      }
      if (session) apply(session);
    });
    return () => data.subscription.unsubscribe();
  }, []);
}
