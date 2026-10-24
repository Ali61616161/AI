// Doğal sesle okuma: Google Cloud Text-to-Speech (Chirp 3 HD / Neural2 / WaveNet sesleri).
// Telefonun yerleşik sesleri çoğu dilde robotik; kullanıcı ayar indirmeden doğal ses duyar.

export const TTS_API_BASE = 'https://texttospeech.googleapis.com/v1';
export const MAX_TTS_CHARS = 600;

export type TtsVoice = { name: string; languageCodes: string[]; ssmlGender?: string };
export type TtsGender = 'female' | 'male';

/** Ses ailelerinin doğallık sırası (büyük önce). */
function rank(name: string): number {
  if (name.includes('Chirp3-HD')) return 6;
  if (name.includes('Chirp-HD')) return 5;
  if (name.includes('Studio')) return 4;
  if (name.includes('Neural2')) return 3;
  if (name.includes('Wavenet')) return 2;
  if (name.includes('Standard')) return 1;
  return 0;
}

/**
 * Dil için en doğal ses: önce tam bölge eşleşmesi (de-DE), yoksa aynı dilin herhangi bir bölgesi;
 * istenen cinsiyet öncelikli. Uygun ses yoksa null (istemci cihaz sesine döner).
 */
export function pickTtsVoice(voices: TtsVoice[], languageCode: string, gender: TtsGender = 'female'): { name: string; languageCode: string } | null {
  const base = languageCode.split('-')[0].toLowerCase();
  const wanted = gender === 'male' ? 'MALE' : 'FEMALE';
  let best: { v: TtsVoice; code: string; score: number } | null = null;
  for (const v of voices) {
    for (const code of v.languageCodes ?? []) {
      if (code.split('-')[0].toLowerCase() !== base) continue;
      const score = rank(v.name) * 100 + (code.toLowerCase() === languageCode.toLowerCase() ? 20 : 0) + (v.ssmlGender === wanted ? 10 : 0);
      if (!best || score > best.score) best = { v, code, score };
    }
  }
  return best ? { name: best.v.name, languageCode: best.code } : null;
}

/** Google'ın hata gövdesindeki kısa neden kodu (ör. SERVICE_DISABLED, PERMISSION_DENIED); anahtar ya da ayrıntı içermez. */
export class TtsError extends Error {
  constructor(readonly httpStatus: number, readonly reason: string) {
    super(`tts http ${httpStatus} ${reason}`);
  }
}

async function ttsError(res: Response): Promise<TtsError> {
  let reason = 'UNKNOWN';
  try {
    const body = await res.json();
    const detail = body?.error?.details?.find((d: { reason?: string }) => typeof d?.reason === 'string')?.reason;
    reason = String(detail ?? body?.error?.status ?? 'UNKNOWN').replace(/[^A-Z0-9_]/gi, '').slice(0, 60) || 'UNKNOWN';
  } catch {
    // gövde okunamadı
  }
  return new TtsError(res.status, reason);
}

let voiceCache: { at: number; voices: TtsVoice[] } | null = null;

/** Tüm sesler (yaklaşık 1 saat önbellekte; liste ücretsizdir). */
export async function listTtsVoices(apiKey: string, apiBase = TTS_API_BASE): Promise<TtsVoice[]> {
  if (voiceCache && Date.now() - voiceCache.at < 3_600_000) return voiceCache.voices;
  const res = await fetch(`${apiBase}/voices`, { headers: { 'X-Goog-Api-Key': apiKey }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw await ttsError(res);
  const body = await res.json();
  const voices: TtsVoice[] = Array.isArray(body?.voices) ? body.voices.filter((v: TtsVoice) => typeof v?.name === 'string' && Array.isArray(v.languageCodes)) : [];
  voiceCache = { at: Date.now(), voices };
  return voices;
}

/** Metni MP3 olarak seslendirir; base64 ses döner. */
export async function synthesize(input: { apiKey: string; apiBase?: string; text: string; voice: { name: string; languageCode: string }; rate?: number }): Promise<string> {
  const res = await fetch(`${input.apiBase ?? TTS_API_BASE}/text:synthesize`, {
    method: 'POST',
    headers: { 'X-Goog-Api-Key': input.apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      input: { text: input.text },
      voice: { languageCode: input.voice.languageCode, name: input.voice.name },
      audioConfig: { audioEncoding: 'MP3', speakingRate: input.rate ?? 1 },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw await ttsError(res);
  const body = await res.json();
  if (typeof body?.audioContent !== 'string' || !body.audioContent) throw new Error('tts empty audio');
  return body.audioContent;
}
