import { FunctionsHttpError } from '@supabase/supabase-js';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';

import type { ImageTranslation } from '../../../supabase/functions/_shared/translate.ts';

export type TranslateErrorCode = 'quota_exceeded' | 'not_configured' | 'upstream_failed' | 'ai_failed' | 'file_too_large' | 'network';

export class TranslateError extends Error {
  constructor(readonly code: TranslateErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'TranslateError';
  }
}

type Quota = { plan: string; remaining: number | null };

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await getSupabase().functions.invoke('translate', { body });
  if (error) {
    let code: TranslateErrorCode = 'network';
    if (error instanceof FunctionsHttpError) {
      const serverCode = (await error.context.json().catch(() => null))?.error?.code;
      code = ['quota_exceeded', 'not_configured', 'ai_failed', 'file_too_large'].includes(serverCode) ? serverCode : 'upstream_failed';
    }
    throw new TranslateError(code, error.message);
  }
  return data as T;
}

export type TextResult = { text: string; detected_source: string | null; quota: Quota };
export type ImageResult = { kind: ImageTranslation['kind']; source_language: string | null; summary: string; items: ImageTranslation['items']; quota: Quota };

function useInvalidateQuota() {
  const queryClient = useQueryClient();
  return (feature: string) => queryClient.invalidateQueries({ queryKey: ['quota', feature] });
}

export function useTranslateText() {
  const invalidate = useInvalidateQuota();
  return useMutation({
    mutationFn: (input: { text: string; target: string; source?: string | null }) =>
      invoke<TextResult>({ mode: 'text', text: input.text, target: input.target, source: input.source ?? undefined }),
    onSettled: () => invalidate('text_translation'),
  });
}

export function useTranslateVoice() {
  const invalidate = useInvalidateQuota();
  return useMutation({
    mutationFn: (input: { text: string; source: string; target: string; seconds: number }) => invoke<TextResult>({ mode: 'voice', ...input }),
    onSettled: () => invalidate('voice_translation'),
  });
}

export function useTranslateImage() {
  const invalidate = useInvalidateQuota();
  return useMutation({
    mutationFn: (input: { base64: string; mimeType: string; target: string }) =>
      invoke<ImageResult>({ mode: 'image', image: input.base64, mime_type: input.mimeType, target: input.target }),
    onSettled: () => invalidate('menu_scan'),
  });
}

export type QuotaStatus = { plan: string; per_day: number | null; used_today: number; per_trip: number | null; used_trip: number };

/** Bugün kalan kullanım (ücretsiz plan limitlerini göstermek için). */
export function useQuotaStatus(feature: 'text_translation' | 'voice_translation' | 'menu_scan' | 'nearby_search' | 'replan') {
  const signedIn = useSessionStore((s) => Boolean(s.session));
  return useQuery({
    queryKey: ['quota', feature],
    enabled: signedIn && isSupabaseConfigured(),
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await getSupabase().rpc('quota_status', { p_feature: feature }).maybeSingle();
      if (error) throw error;
      return data as QuotaStatus | null;
    },
  });
}
