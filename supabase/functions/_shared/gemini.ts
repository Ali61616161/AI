// Gemini API ile yapılandırılmış (JSON şemalı) içerik üretimi.
// Doküman: https://ai.google.dev/api/generate-content

/** Varsayılan model; GEMINI_MODEL sırrıyla değiştirilebilir. (2.5-flash yeni hesaplara kapatıldı.) */
export const DEFAULT_GEMINI_MODEL = 'gemini-3.8-flash';

export type GeminiFile = { mimeType: string; base64: string };

export type GeminiRequest = {
  apiKey: string;
  model: string;
  prompt: string;
  file?: GeminiFile;
  responseSchema: unknown;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  /** Varsayılan Google adresi; sadece testlerde (GEMINI_API_BASE) değiştirilir. */
  apiBase?: string;
  /** Geçici hatalarda (429/500/503) tekrar denemeden önceki beklemeler; testlerde kısaltılır. */
  retryDelaysMs?: number[];
};

/** Model yoğunluğu gibi geçici durumlar; tekrar denemeye değer. */
const TRANSIENT = new Set([429, 500, 503]);
const RETRY_DELAYS_MS = [1_000, 3_000];

export class GeminiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly reason: 'http' | 'blocked' | 'empty' | 'invalid_json' | 'timeout',
  ) {
    super(message);
    this.name = 'GeminiError';
  }
}

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function buildGeminiBody(req: Pick<GeminiRequest, 'prompt' | 'file' | 'responseSchema'>) {
  const parts: Record<string, unknown>[] = [{ text: req.prompt }];
  if (req.file) parts.push({ inline_data: { mime_type: req.file.mimeType, data: req.file.base64 } });
  return {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: req.responseSchema,
    },
  };
}

/** Modeli çağırır ve şemaya uygun JSON'u ayrıştırılmış nesne olarak döndürür.
 *  Geçici HTTP hatalarında birkaç kez bekleyip yeniden dener. */
export async function generateJson(req: GeminiRequest): Promise<unknown> {
  const delays = req.retryDelaysMs ?? RETRY_DELAYS_MS;
  for (let attempt = 0; ; attempt++) {
    try {
      return await generateOnce(req);
    } catch (error) {
      const retry = error instanceof GeminiError && error.reason === 'http' && TRANSIENT.has(error.status) && attempt < delays.length;
      if (!retry) throw error;
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]));
    }
  }
}

async function generateOnce(req: GeminiRequest): Promise<unknown> {
  const fetchImpl = req.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), req.timeoutMs ?? 60_000);

  let response: Response;
  try {
    response = await fetchImpl(`${req.apiBase ?? API_BASE}/${encodeURIComponent(req.model)}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': req.apiKey },
      body: JSON.stringify(buildGeminiBody(req)),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new GeminiError('Gemini request timed out', 504, 'timeout');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new GeminiError(`Gemini HTTP ${response.status}: ${text.slice(0, 300)}`, response.status, 'http');
  }

  const data = (await response.json()) as {
    promptFeedback?: { blockReason?: string };
    candidates?: { finishReason?: string; content?: { parts?: { text?: string }[] } }[];
  };
  if (data.promptFeedback?.blockReason) {
    throw new GeminiError(`Gemini blocked the request: ${data.promptFeedback.blockReason}`, 422, 'blocked');
  }
  const candidate = data.candidates?.[0];
  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
  if (!text) {
    throw new GeminiError(`Gemini returned no content (${candidate?.finishReason ?? 'unknown'})`, 502, 'empty');
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new GeminiError('Gemini returned invalid JSON', 502, 'invalid_json');
  }
}
