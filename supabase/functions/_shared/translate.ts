// Çeviri merkezi: Google Cloud Translation (v2) ile metin çevirisi ve Gemini ile
// fotoğraftaki menü/tabela çevirisi. İstek alanları google/schema.json ile test edilir.
//
// Sunucu sırrı: GOOGLE_TRANSLATE_API_KEY (yoksa GOOGLE_MAPS_API_KEY; Cloud
// Translation API açık olmalı). GOOGLE_TRANSLATE_API_BASE sadece testlerde kullanılır.

export const TRANSLATE_API_BASE = 'https://translation.googleapis.com';
export const TRANSLATE_PATH = 'language/translate/v2';
export const MAX_TEXT_LENGTH = 2000;

/** BCP-47 dil kodu (ör. tr, en, pt-BR, zh-CN). */
export function isLanguageCode(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(value);
}

export type TranslateTextRequest = { q: string[]; target: string; source?: string; format: 'text'; model?: string };

export function translateRequest(input: { text: string; target: string; source?: string | null }): TranslateTextRequest {
  return {
    q: [input.text.slice(0, MAX_TEXT_LENGTH)],
    target: input.target,
    ...(input.source ? { source: input.source } : {}),
    format: 'text',
  };
}

export class TranslateError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

export async function translateText(options: {
  apiKey: string;
  text: string;
  target: string;
  source?: string | null;
  fetchImpl?: typeof fetch;
  apiBase?: string;
}): Promise<{ text: string; detectedSource: string | null }> {
  const doFetch = options.fetchImpl ?? fetch;
  const res = await doFetch(`${options.apiBase ?? TRANSLATE_API_BASE}/${TRANSLATE_PATH}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': options.apiKey },
    body: JSON.stringify(translateRequest(options)),
    signal: AbortSignal.timeout(10_000),
  }).catch((e) => {
    throw new TranslateError(`translate request failed: ${e instanceof Error ? e.message : String(e)}`, null);
  });
  if (!res.ok) throw new TranslateError(`translate http ${res.status}: ${(await res.text()).slice(0, 300)}`, res.status);
  const data = await res.json();
  const t = data?.data?.translations?.[0] ?? data?.translations?.[0];
  if (typeof t?.translatedText !== 'string') throw new TranslateError('translate: empty response', res.status);
  return { text: t.translatedText, detectedSource: typeof t.detectedSourceLanguage === 'string' ? t.detectedSourceLanguage : null };
}

// ---------------------------------------------------------------------------
// Fotoğraftan çeviri (Gemini)
// ---------------------------------------------------------------------------

export const IMAGE_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    kind: { type: 'STRING', enum: ['menu', 'sign', 'document', 'other'] },
    source_language: { type: 'STRING', description: 'BCP-47 code of the text in the photo' },
    summary: { type: 'STRING', description: 'One or two sentences in the target language' },
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          original: { type: 'STRING' },
          translated: { type: 'STRING' },
          note: { type: 'STRING', description: 'For dishes: main ingredients, allergens or what it is; otherwise empty' },
          price: { type: 'STRING' },
          section: { type: 'STRING', description: 'Menu section such as starters or drinks' },
        },
        required: ['original', 'translated'],
      },
    },
  },
  required: ['kind', 'summary', 'items'],
};

export function buildImagePrompt(targetLanguage: string): string {
  return `You are a travel translator. Read all text in the photo (a restaurant menu, a sign, a notice or a ticket).

- Translate every meaningful line into ${targetLanguage}. Keep the original text exactly as written in "original".
- For menus: one item per dish or drink, keep prices as written, put the section name in "section", and in "note" explain briefly what the dish is, its main ingredients and common allergens (nuts, gluten, dairy, shellfish, pork, alcohol) when they are typical for it.
- For signs and notices: one item per sentence or label; in "summary" say what it means for a traveler (e.g. "No entry after 18:00").
- If there is no readable text, return kind "other", an empty items list and say so in the summary.
- Write summary, translated and note in ${targetLanguage}.`;
}

export type ImageTranslation = {
  kind: 'menu' | 'sign' | 'document' | 'other';
  sourceLanguage: string | null;
  summary: string;
  items: { original: string; translated: string; note: string | null; price: string | null; section: string | null }[];
};

const clean = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null);

export function normalizeImageTranslation(raw: unknown): ImageTranslation {
  // deno-lint-ignore no-explicit-any
  const r = (raw && typeof raw === 'object' ? raw : {}) as any;
  const kind = ['menu', 'sign', 'document', 'other'].includes(r.kind) ? r.kind : 'other';
  const items = (Array.isArray(r.items) ? r.items : [])
    .slice(0, 80)
    // deno-lint-ignore no-explicit-any
    .map((i: any) => ({
      original: clean(i?.original, 300),
      translated: clean(i?.translated, 400),
      note: clean(i?.note, 300),
      price: clean(i?.price, 30),
      section: clean(i?.section, 60),
    }))
    .filter((i: { original: string | null; translated: string | null }) => i.original && i.translated);
  return {
    kind,
    sourceLanguage: isLanguageCode(r.source_language) ? r.source_language : null,
    summary: clean(r.summary, 600) ?? '',
    items,
  };
}
