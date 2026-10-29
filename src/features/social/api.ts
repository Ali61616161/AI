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

export type SocialProfile = { is_visible: boolean; looking_for: string[]; city: string | null; available_until: string | null };
export type SocialMe = { display_name: string | null; birth_year: number | null; bio: string | null; social: SocialProfile | null };

export function useSocialMe() {
  const userId = useUser();
  return useQuery({
    queryKey: ['social-me', userId],
    enabled: enabled(userId),
    queryFn: async (): Promise<SocialMe> => {
      const supabase = getSupabase();
      const [{ data: profile, error }, { data: social }] = await Promise.all([
        supabase.from('profiles').select('display_name, birth_year, bio').eq('id', userId!).single(),
        supabase.from('social_profiles').select('is_visible, looking_for, city, available_until').eq('user_id', userId!).maybeSingle(),
      ]);
      if (error) throw error;
      return { ...profile, social: social ?? null };
    },
  });
}

export type GoVisibleInput = {
  displayName: string;
  birthYear: number;
  bio: string;
  lookingFor: string[];
  location: { lat: number; lng: number };
  city: string | null;
  countryCode: string | null;
  until: string | null;
};

export type SocialErrorCode = 'age_required' | 'name_required' | 'identity_locked' | 'suspended' | 'unknown';

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
        .update({ display_name: input.displayName.trim().slice(0, 60), birth_year: input.birthYear, bio: input.bio.trim().slice(0, 300) || null })
        .eq('id', userId!);
      if (profileError) {
        if ((profileError as { hint?: string }).hint === 'identity_locked') throw new SocialError('identity_locked');
        throw profileError;
      }
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
        available_until: input.until,
      });
      if (error) {
        const hint = (error as { hint?: string }).hint;
        throw new SocialError(hint === 'age_required' || hint === 'name_required' || hint === 'suspended' ? hint : 'unknown');
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
    mutationFn: async (input: { userId: string; inviteId?: string; messageId?: number; reason?: (typeof REPORT_REASONS)[number]; details?: string; blockToo?: boolean }) => {
      const supabase = getSupabase();
      if (input.reason) {
        const { error } = await supabase
          .from('user_reports')
          .insert({ reported_id: input.userId, invite_id: input.inviteId ?? null, message_id: input.messageId ?? null, reason: input.reason, details: input.details?.slice(0, 1000) || null });
        if (error) throw error;
      }
      if (input.blockToo === false) return;
      const { error } = await supabase.from('user_blocks').insert({ blocked_id: input.userId });
      if (error && error.code !== '23505') throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invites'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-travelers'] });
    },
  });
}

export type BlockedUser = { blocked_id: string; display_name: string | null; avatar_url: string | null; created_at: string };

/** Engellediklerim (görünen ad/fotoğraf sunucu işleviyle gelir; profiller başkalarına kapalıdır). */
export function useBlockedUsers() {
  const userId = useUser();
  return useQuery({
    queryKey: ['blocked-users', userId],
    enabled: enabled(userId),
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('my_blocks');
      if (error) throw error;
      return (data ?? []) as BlockedUser[];
    },
  });
}

/** Engeli kaldırır. İptal olmuş davetler geri gelmez; kişi yeniden listede görünür ve yeni davet gönderilebilir. */
export function useUnblock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (blockedId: string) => {
      const { error } = await getSupabase().from('user_blocks').delete().eq('blocked_id', blockedId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['blocked-users'] });
      queryClient.invalidateQueries({ queryKey: ['nearby-travelers'] });
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
  });
}

export type MessageTranslation = { text: string; same: boolean };
export type TranslateErrorCode = 'quota_exceeded' | 'failed';

/** Karşı tarafın mesajını (ya da davet notunu) uygulamanın diline çevirir. Çeviri sunucuda saklanmaz. */
export async function translateMessage(target: { messageId: number } | { inviteId: string }, language: string): Promise<MessageTranslation> {
  const body = 'messageId' in target ? { message_id: target.messageId, language } : { invite_id: target.inviteId, language };
  const { data, error } = await getSupabase().functions.invoke('translate-message', { body });
  if (error) {
    const status = (error as { context?: { status?: number } }).context?.status;
    throw Object.assign(new Error('translate failed'), { code: (status === 429 ? 'quota_exceeded' : 'failed') satisfies TranslateErrorCode });
  }
  const result = data as Partial<MessageTranslation> | null;
  if (typeof result?.text !== 'string') throw Object.assign(new Error('translate failed'), { code: 'failed' satisfies TranslateErrorCode });
  return { text: result.text, same: Boolean(result.same) };
}

/** Kendi mesajını siler (karşı tarafa da görünmez olur). Şikayet delili sunucuda 30 gün saklanır. */
export function useDeleteMessage(inviteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: number) => {
      const { error } = await getSupabase().rpc('delete_message', { p_message_id: messageId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages', inviteId] });
      queryClient.invalidateQueries({ queryKey: ['invites'] });
    },
  });
}

export type ModerationReport = {
  id: string;
  created_at: string;
  reason: (typeof REPORT_REASONS)[number];
  details: string | null;
  status: 'open' | 'reviewing' | 'resolved';
  resolution: 'dismissed' | 'warned' | 'suspended' | 'banned' | null;
  reporter_id: string;
  reporter_name: string | null;
  reported_id: string;
  reported_name: string | null;
  message_id: number | null;
  evidence: {
    invite_message: string | null;
    place: string;
    meet_at: string;
    invited_by: 'reporter' | 'reported';
    messages: { id: number; from: 'reporter' | 'reported'; body: string; at: string; deleted: boolean }[];
  } | null;
  reports_on_reported: number;
  reports_by_reporter: number;
  reported_suspended: boolean;
};

/** Hesap moderatör mü (yönetici e-postası). Değilse Moderasyon ekranı hiç görünmez. */
export function useIsModerator() {
  const userId = useUser();
  return useQuery({
    queryKey: ['is-moderator', userId],
    enabled: enabled(userId),
    staleTime: 3600_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('is_moderator');
      if (error) throw error;
      return data === true;
    },
  });
}

export function useModerationQueue() {
  const userId = useUser();
  return useQuery({
    queryKey: ['moderation-queue', userId],
    enabled: enabled(userId),
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('moderation_queue');
      if (error) throw error;
      return (data ?? []) as unknown as ModerationReport[];
    },
  });
}

export function useResolveReport() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; action: 'dismissed' | 'warned' | 'suspended' | 'banned' }) => {
      const { error } = await getSupabase().rpc('moderation_resolve', { p_report_id: input.id, p_action: input.action });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['moderation-queue'] }),
  });
}
