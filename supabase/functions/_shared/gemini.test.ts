import { assertEquals, assertRejects } from 'jsr:@std/assert@1';

import { GeminiError, generateJson } from './gemini.ts';

type Captured = { url: string; init: RequestInit };

function stubFetch(status: number, body: unknown, captured: Captured[] = []): typeof fetch {
  return ((url: string, init: RequestInit) => {
    captured.push({ url, init });
    return Promise.resolve(new Response(typeof body === 'string' ? body : JSON.stringify(body), { status }));
  }) as typeof fetch;
}

const base = { apiKey: 'test-key', model: 'gemini-test', prompt: 'read this', responseSchema: { type: 'OBJECT' } };

Deno.test('generateJson: isteği doğru biçimde gönderir ve JSON cevabı ayrıştırır', async () => {
  const captured: Captured[] = [];
  const result = await generateJson({
    ...base,
    file: { mimeType: 'application/pdf', base64: 'JVBERi0=' },
    fetchImpl: stubFetch(200, { candidates: [{ content: { parts: [{ text: '{"items":[]}' }] } }] }, captured),
  });

  assertEquals(result, { items: [] });
  assertEquals(captured[0].url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
  assertEquals((captured[0].init.headers as Record<string, string>)['x-goog-api-key'], 'test-key');
  const body = JSON.parse(captured[0].init.body as string);
  assertEquals(body.contents[0].parts[1], { inline_data: { mime_type: 'application/pdf', data: 'JVBERi0=' } });
  assertEquals(body.generationConfig.responseMimeType, 'application/json');
  assertEquals(body.generationConfig.responseSchema, { type: 'OBJECT' });
});

Deno.test('generateJson: HTTP hatası, engelleme, boş ve bozuk cevap', async () => {
  const http = await assertRejects(() => generateJson({ ...base, fetchImpl: stubFetch(403, 'API key invalid') }), GeminiError);
  assertEquals(http.reason, 'http');
  assertEquals(http.status, 403);

  const blocked = await assertRejects(
    () => generateJson({ ...base, fetchImpl: stubFetch(200, { promptFeedback: { blockReason: 'SAFETY' } }) }),
    GeminiError,
  );
  assertEquals(blocked.reason, 'blocked');

  const empty = await assertRejects(
    () => generateJson({ ...base, fetchImpl: stubFetch(200, { candidates: [{ finishReason: 'MAX_TOKENS' }] }) }),
    GeminiError,
  );
  assertEquals(empty.reason, 'empty');

  const invalid = await assertRejects(
    () => generateJson({ ...base, fetchImpl: stubFetch(200, { candidates: [{ content: { parts: [{ text: 'not json' }] } }] }) }),
    GeminiError,
  );
  assertEquals(invalid.reason, 'invalid_json');
});
