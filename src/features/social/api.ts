import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

export const LOOKING_FOR = ['coffee', 'museum', 'walk', 'food', 'nightlife', 'nature'] as const;
export type LookingFor = (typeof LOOKING_FOR)[number];
export const CONSENT_VERSION = '2026-10';

function useUser() {
  return useSessionStore((s) => s.session?.user.id ?? null);
}
const enabled = (userId: string | null) => Boolean(userId) && isSupabaseConfigured();

export type SocialProfile = { is_visible: boolean; looking_for: string[]; women_only: boolean; city: string | null; available_until: string | null };
export type SocialMe = { display_name: string | null; birth_year: number | null; gender: string; bio: string | null; social: SocialProfile | null };

export function useSocialMe() {
  const userId = useUser();
  return useQuery({
    queryKey: ['social-me', userId],
    enabled: enabled(userId),
    queryFn: async (): Promise<SocialMe> => {
      const supabase = getSupabase();
      const [{ data: profile, error }, { data: social }] = await Promise.all([
        supabase.from('profiles').select('display_name, birth_year, gender, bio').eq('id', userId!).single(),
        supabase.from('social_profiles').select('is_visible, looking_for, women_only, city, available_until').eq('user_id', userId!).maybeSingle(),
      ]);
      if (error) throw error;
      return { ...profile, social: social ?? null };
    },
  });
}

export type GoVisibleInput = {
  displayName: string;
  birthYear: number;
  gender: string;
  bio: string;
  lookingFor: string[];
  womenOnly: boolean;
  location: { lat: number; lng: number };
  city: string | null;
  countryCode: string | null;
  until: string | null;
};

export type SocialErrorCode = 'age_required' | 'name_required' | 'women_only' | 'unknown';

export class SocialError extends Error {
  constructor(readonly code: SocialErrorCode) {
    super(code);
  }
}

/** Profil bilgilerini ve rızaları kaydeder, sosyal profili görünür yapar. */
export function useGoVisible() {
  const queryClient = useQueryClient();
  const userId = useUser();
  return useMutation({
    mutationFn: async (input: GoVisibleInput) => {
      const supabase = getSupabase();
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ display_name: input.displayName.trim().slice(0, 60), birth_year: input.birthYear, gender: input.gender, bio: input.bio.trim().slice(0, 300) || null })
        .eq('id', userId!);
      if (profileError) throw profileError;
      const { error: consentError } = await supabase.from('consents').insert([
        { consent: 'social_matching', granted: true, version: CONSENT_VERSION },
        { consent: 'location', granted: true, version: CONSENT_VERSION },
      ]);
      if (consentError) throw consentError;
      const { error } = await supabase.from('social_profiles').upsert({
        user_id: userId!,
        is_visible: true,
        approx_location: `SRID=4326;POINT(${input.location.lng} ${input.location.lat})`,
        city: input.city,
        country_code: input.countryCode,
        looking_for: input.lookingFor,
        women_only: input.womenOnly,
        available_until: input.until,
      });
      if (error) {
        const hint = (error as { hint?: string }).hint;
        throw new SocialError(hint === 'age_required' || hint === 'name_required' || hint === 'women_only' ? hint : 'unknown');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-me'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-travelers'] });
    },
  });
}

/** Konumu tazeler (uygulama açıkken arada bir). */
export function useRefreshLocation() {
  const userId = useUser();
  return useMutation({
    mutationFn: async (location: { lat: number; lng: number }) => {
      await getSupabase()
        .from('social_profiles')
        .update({ approx_location: `SRID=4326;POINT(${location.lng} ${location.lat})` })
        .eq('user_id', userId!);
    },
  });
}

export function useHide() {
  const queryClient = useQueryClient();
  const userId = useUser();
  return useMutation({
    mutationFn: async () => {
      const supabase = getSupabase();
      const { error } = await supabase.from('social_profiles').update({ is_visible: false }).eq('user_id', userId!);
      if (error) throw error;
      await supabase.from('consents').insert({ consent: 'social_matching', granted: false, version: CONSENT_VERSION });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['social-me'] }),
  });
}

export type Traveler = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  interests: string[];
  looking_for: string[];
  is_verified: boolean;
  city: string | null;
  available_until: string | null;
  distance_km: number;
};

export function useNearbyTravelers(visible: boolean) {
  const userId = useUser();
  return useQuery({
    queryKey: ['nearby-travelers', userId],
    enabled: enabled(userId) && visible,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('nearby_travelers', { p_radius_km: 10 });
      if (error) throw error;
      return (data ?? []) as Traveler[];
    },
  });
}

export type Invite = {
  id: string;
  incoming: boolean;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';
  place_name: string;
  google_place_id: string;
  place_lat: number | null;
  place_lng: number | null;
  meet_at: string;
  message: string | null;
  other_id: string;
  other_name: string | null;
  other_avatar: string | null;
  other_verified: boolean;
  last_message: string | null;
  last_message_at: string | null;
};

export function useMyInvites() {
  const userId = useUser();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ['invites', userId],
    enabled: enabled(userId),
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('my_invites');
      if (error) throw error;
      return (data ?? []) as Invite[];
    },
  });
  // Yeni davet ve yanıtlar anında gelsin (Realtime; olmazsa 30 sn'de bir yenilenir).
  useEffect(() => {
    if (!enabled(userId)) return;
    const channel = getSupabase()
      .channel(`invites-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_invites' }, () => queryClient.invalidateQueries({ queryKey: ['invites', userId] }))
      .subscribe();
    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [userId, queryClient]);
  return query;
}

export type InviteErrorCode = 'quota_exceeded' | 'unavailable' | 'past' | 'unknown';

export function useSendInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { to: string; placeId: string; placeName: string; lat: number; lng: number; meetAt: Date; message: string }) => {
      const { data, error } = await getSupabase().rpc('send_invite', {
        p_to_user: input.to,
        p_google_place_id: input.placeId,
        p_place_name: input.placeName,
        p_place_lng: input.lng,
        p_place_lat: input.lat,
        p_meet_at: input.meetAt.toISOString(),
        p_message: input.message.trim().slice(0, 280) || undefined,
      });
      if (error) {
        const code: InviteErrorCode = error.hint === 'upgrade' ? 'quota_exceeded' : error.message.includes('not available') ? 'unavailable' : error.message.includes('future') ? 'past' : 'unknown';
        throw Object.assign(new Error(code), { code });
      }
      return data as string;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites'] }),
  });
}

export function useRespondInvite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: 'accepted' | 'declined' | 'cancelled' }) => {
      const { error } = await getSupabase().rpc('respond_invite', { p_invite_id: input.id, p_status: input.status });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invites'] }),
  });
}

export type Message = { id: number; sender_id: string; body: string; created_at: string };

export function useMessages(inviteId: string | undefined) {
  const userId = useUser();
  const queryClient = useQueryClient();
  const key = ['messages', inviteId];
  const query = useQuery({
    queryKey: key,
    enabled: enabled(userId) && Boolean(inviteId),
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().from('messages').select('id, sender_id, body, created_at').eq('invite_id', inviteId!).order('created_at');
      if (error) throw error;
      return data as Message[];
    },
  });
  useEffect(() => {
    if (!enabled(userId) || !inviteId) return;
    const channel = getSupabase()
      .channel(`messages-${inviteId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `invite_id=eq.${inviteId}` }, () =>
        queryClient.invalidateQueries({ queryKey: ['messages', inviteId] }),
      )
      .subscribe();
    return () => {
      getSupabase().removeChannel(channel);
    };
  }, [inviteId, userId, queryClient]);
  return query;
}

export function useSendMessage(inviteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      const { error } = await getSupabase().from('messages').insert({ invite_id: inviteId, body: body.trim().slice(0, 2000) });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', inviteId] });
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
  });
}

export const REPORT_REASONS = ['harassment', 'fake_profile', 'unsafe_behavior', 'spam', 'other'] as const;

export function useBlockAndReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; inviteId?: string; reason?: (typeof REPORT_REASONS)[number]; details?: string }) => {
      const supabase = getSupabase();
      if (input.reason) {
        const { error } = await supabase.from('user_reports').insert({ reported_id: input.userId, invite_id: input.inviteId ?? null, reason: input.reason, details: input.details?.slice(0, 1000) || null });
        if (error) throw error;
      }
      const { error } = await supabase.from('user_blocks').insert({ blocked_id: input.userId });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-travelers'] });
    },
  });
}
