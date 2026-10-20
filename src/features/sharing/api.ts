import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

export type SentInvite = { id: string; email: string; token: string; accepted_at: string | null; expires_at: string };
export type PendingInvite = { token: string; trip_id: string; trip_title: string; created_at: string };

export class ShareError extends Error {
  constructor(readonly code: 'pro_required' | 'invalid_email' | 'self' | 'too_many' | 'unknown') {
    super(code);
  }
}

function shareErrorFrom(message: string): ShareError {
  if (message.includes('pro required')) return new ShareError('pro_required');
  if (message.includes('invalid email')) return new ShareError('invalid_email');
  if (message.includes('yourself')) return new ShareError('self');
  if (message.includes('too many')) return new ShareError('too_many');
  return new ShareError('unknown');
}

/** Davetin bağlantısı: uygulamada açılınca daveti kabul etme ekranına gider. */
export const inviteLink = (token: string) => `yola://join?token=${token}`;

/** Seyahatin sahibinin gönderdiği davetler (kabul edilmiş ya da bekleyen). */
export function useTripInvites(tripId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['trip-invites', tripId],
    enabled,
    queryFn: async () => {
      const { data, error } = await getSupabase().from('trip_invites').select('id, email, token, accepted_at, expires_at').eq('trip_id', tripId).order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as SentInvite[];
    },
  });
}

export function useCreateTripInvite(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (email: string) => {
      const { data, error } = await getSupabase().rpc('create_trip_invite', { p_trip_id: tripId, p_email: email });
      if (error) throw shareErrorFrom(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip-invites', tripId] }),
  });
}

export function useRevokeTripInvite(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await getSupabase().rpc('revoke_trip_invite', { p_invite_id: inviteId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['trip-invites', tripId] }),
  });
}

/** Giriş yapılan e-postaya gelen, henüz kabul edilmemiş seyahat davetleri. */
export function useMyTripInvites() {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  return useQuery({
    queryKey: ['my-trip-invites', userId],
    enabled: userId !== null,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('my_trip_invites');
      if (error) throw error;
      return (data ?? []) as PendingInvite[];
    },
  });
}

export function useAcceptTripInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await getSupabase().rpc('accept_trip_invite', { p_token: token });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-trip-invites'] });
      queryClient.invalidateQueries({ queryKey: ['trips'] });
    },
  });
}
