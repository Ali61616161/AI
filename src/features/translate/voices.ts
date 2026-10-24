// Sesli okumada en doğal sesi seçme mantığı (saf fonksiyon; arayüz bağımlılığı yok).
// iOS'ta varsayılan ses çoğu zaman "kompakt" ve robotsu olur; "Gelişmiş/Premium/Siri" sesler çok daha doğaldır.

export type VoiceLike = { identifier: string; name: string; quality?: string; language: string };

const norm = (tag: string) => tag.replace(/_/g, '-').toLowerCase();

/** Bu ses okunmaya değer mi: iOS'un eğlence/efekt sesleri (Zarvox, Bubbles...) elenir. */
function usable(v: VoiceLike): boolean {
  return !/com\.apple\.speech\.synthesis\.voice/i.test(v.identifier);
}

function languageScore(voiceLang: string, wanted: string): number {
  const a = norm(voiceLang);
  const b = norm(wanted);
  if (a === b) return 10;
  return a.split('-')[0] === b.split('-')[0] ? 5 : 0;
}

/** Sesin kalite puanı: Siri > Premium > Gelişmiş > normal > kompakt. Android'de "network" sesler daha iyidir. */
export function qualityScore(v: VoiceLike): number {
  const id = v.identifier.toLowerCase();
  let score = 0;
  if (id.includes('siri')) score += 6;
  if (id.includes('premium')) score += 5;
  if (id.includes('enhanced') || v.quality === 'Enhanced') score += 4;
  if (id.includes('compact')) score -= 3;
  if (id.includes('network')) score += 3;
  if (id.includes('local')) score -= 1;
  return score;
}

/** İstenen dil için sesleri en iyiden başlayarak sıralar (başka dil ve efekt sesleri dışarıda). */
export function rankVoices<T extends VoiceLike>(voices: readonly T[], speechTag: string): T[] {
  return voices
    .filter(usable)
    .map((v) => ({ v, lang: languageScore(v.language, speechTag) }))
    .filter((x) => x.lang > 0)
    .sort((a, b) => b.lang + qualityScore(b.v) - (a.lang + qualityScore(a.v)) || a.v.name.localeCompare(b.v.name))
    .map((x) => x.v);
}

/** Kullanıcının seçtiği ses varsa (hâlâ yüklüyse) o; yoksa en iyi ses; hiç yoksa null (sistem varsayılanı). */
export function pickVoice<T extends VoiceLike>(voices: readonly T[], speechTag: string, preferredId?: string | null): T | null {
  const ranked = rankVoices(voices, speechTag);
  return ranked.find((v) => v.identifier === preferredId) ?? ranked[0] ?? null;
}

/** Ses önizleme cümleleri (dilin ilk kısmına göre). */
export const PREVIEW_TEXT: Record<string, string> = {
  tr: 'Merhaba, nasılsın? Seninle tanıştığıma memnun oldum.',
  en: 'Hello, how are you? Nice to meet you.',
  de: 'Hallo, wie geht es dir? Schön, dich kennenzulernen.',
  es: 'Hola, ¿cómo estás? Encantado de conocerte.',
  fr: 'Bonjour, comment ça va ? Ravi de te rencontrer.',
  it: 'Ciao, come stai? Piacere di conoscerti.',
  ru: 'Привет, как дела? Рад познакомиться.',
  ar: 'مرحبًا، كيف حالك؟ سررت بلقائك.',
  zh: '你好，你好吗？很高兴认识你。',
  ja: 'こんにちは、お元気ですか？はじめまして。',
  ko: '안녕하세요, 잘 지내세요? 만나서 반갑습니다.',
};

export function previewText(speechTag: string): string {
  return PREVIEW_TEXT[norm(speechTag).split('-')[0]] ?? PREVIEW_TEXT.en;
}

/** Yola'nın doğal (bulut) sesleri: seçim mağazasında bu kimliklerle tutulur. */
export const CLOUD_VOICES = ['yola:female', 'yola:male'] as const;
export type CloudVoice = (typeof CLOUD_VOICES)[number];

export const isCloudVoice = (id: string | null | undefined): id is CloudVoice => id === 'yola:female' || id === 'yola:male';

/** Seçim yoksa kadın sesi. */
export const cloudGender = (id: string | null | undefined): 'female' | 'male' => (id === 'yola:male' ? 'male' : 'female');
