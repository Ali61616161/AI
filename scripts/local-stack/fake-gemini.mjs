#!/usr/bin/env node
// Gemini API'nin TEST İKİZİ: generateContent isteğine şemaya uygun, öngörülebilir
// JSON döndürür. Edge Function'ların AI dışındaki bütün yolunu (kota, veritabanı,
// plan sürümleri) gerçek AI anahtarı olmadan uçtan uca test etmek içindir.
// Uygulamada ve gerçek ortamda KULLANILMAZ.
import http from 'node:http';

const PORT = Number(process.env.FAKE_GEMINI_PORT ?? 54340);
export const calls = [];

function itinerary(prompt) {
  const days = (/Days to plan: ([^\n]+)/.exec(prompt)?.[1] ?? '').split(',').map((d) => d.trim()).filter(Boolean);
  return {
    summary: `TEST plan for ${days.length} day(s).`,
    days: days.map((date, i) => ({
      date,
      city: 'Roma',
      timezone: 'Europe/Rome',
      title: `TEST day ${i + 1}`,
      items: [
        { start_time: '09:30', end_time: '11:00', kind: 'activity', title: `TEST museum ${date}`, place_name: 'TEST Musei Vaticani', priority: 5, is_indoor: true, booking: 'tiqets', estimated_cost: 20, currency: 'EUR' },
        { start_time: '12:30', end_time: '13:30', kind: 'meal', title: `TEST lunch ${date}`, priority: 2, is_indoor: true, booking: 'none', estimated_cost: 12, currency: 'EUR' },
        { start_time: '16:00', end_time: '17:30', kind: 'activity', title: `TEST walk ${date}`, place_name: 'Nowhere Street', priority: 3, is_indoor: false, booking: 'none', estimated_cost: 0, currency: 'EUR' },
      ],
    })),
  };
}

function crisis(prompt) {
  const now = /Local time: \S+ (\d{2}):(\d{2})/.exec(prompt);
  const minutes = now ? Number(now[1]) * 60 + Number(now[2]) + 30 : 12 * 60;
  const at = (m) => `${String(Math.floor(Math.min(m, 1439) / 60)).padStart(2, '0')}:${String(Math.min(m, 1439) % 60).padStart(2, '0')}`;
  return {
    reply: `TEST reply: here are indoor options nearby. Weather: ${/Weather now: ([^\n]+)/.exec(prompt)?.[1] ?? 'none'}`,
    change_plan: !prompt.includes('Remaining plan today: nothing planned'),
    items: [
      { start_time: at(minutes), end_time: at(minutes + 60), kind: 'activity', title: 'TEST indoor gallery', priority: 4, is_indoor: true, booking: 'none', estimated_cost: 15, currency: 'EUR' },
      { start_time: at(minutes + 90), kind: 'meal', title: 'TEST cafe', place_name: 'TEST Caffè Roma', priority: 2, is_indoor: true, booking: 'none' },
    ],
  };
}

http
  .createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    const prompt = body.contents?.[0]?.parts?.[0]?.text ?? '';
    const kind = prompt.includes('The traveler says') ? 'crisis' : prompt.includes('Days to plan') ? 'itinerary' : 'other';
    calls.push(kind);
    const payload = kind === 'crisis' ? crisis(prompt) : kind === 'itinerary' ? itinerary(prompt) : { document_type: 'other', items: [] };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: 'STOP' }] }));
  })
  .listen(PORT, () => console.log(`fake gemini :${PORT}`));
