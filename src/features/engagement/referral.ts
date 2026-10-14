import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

export type RedeemReason = 'invalid_code' | 'own_code' | 'already_redeemed' | 'too_late' | 'referrer_limit' | 'network';
export type RedeemResult = { ok: true; days: number } | { ok: false; reason: RedeemReason };

/** App Store bağlantısı (Android yayınlanınca Play bağlantısı da eklenir). */
export const APP_STORE_URL = 'https://apps.apple.com/app/id6821770666';

function useUserId() {
  return useSessionStore((s) => s.session?.user.id ?? null);
}

/** Kullanıcının davet kodu ve davet ettiği kişi sayısı. */
export function useReferral() {
  const userId = useUserId();
  return useQuery({
    queryKey: ['referral', userId],
    enabled: Boolean(userId) && isSupabaseConfigured(),
    queryFn: async () => {
      const [code, count] = await Promise.all([getSupabase().rpc('my_referral_code'), getSupabase().rpc('referral_count')]);
      if (code.error) throw code.error;
      return { code: code.data as string, count: (count.data as number | null) ?? 0 };
    },
  });
}

/** Arkadaşın kodunu kullanır; başarılıysa abonelik durumu yenilenir. */
export function useRedeemReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string): Promise<RedeemResult> => {
      const { data, error } = await getSupabase().rpc('redeem_referral', { p_code: code.trim().toUpperCase() });
      if (error) return { ok: false, reason: 'network' };
      return data as unknown as RedeemResult;
    },
    onSuccess: (result) => {
      if (result.ok) queryClient.invalidateQueries();
    },
  });
}

/** Kod biçimi: 6 karakter, karışan harfler (0, O, 1, I) yok. */
export const isReferralCode = (v: string) => /^[A-HJ-NP-Z2-9]{6}$/.test(v.trim().toUpperCase());
