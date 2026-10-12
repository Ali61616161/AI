#!/usr/bin/env node
// Gemini API'nin TEST İKİZİ: generateContent isteğine şemaya uygun, öngörülebilir
// JSON döndürür. Edge Function'ların AI dışındaki bütün yolunu (kota, veritabanı,
// plan sürümleri) gerçek AI anahtarı olmadan uçtan uca test etmek içindir.
// Uygulamada ve gerçek ortamda KULLANILMAZ.
import http from 'node:http';

const PORT = Number(process.env.FAKE_GEMINI_PORT ?? 54340);
export const calls = [];
const prompts = [];

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
        // Gecenin son durağı: "Planı Değiştir" testi günün her saatinde değiştirilecek bir durak bulsun.
        { start_time: '23:55', end_time: '23:59', kind: 'free_time', title: `TEST night ${date}`, priority: 1, is_indoor: false, booking: 'none', estimated_cost: 0, currency: 'EUR' },
      ],
    })),
  };
}

function evening(prompt) {
  return {
    title: `TEST evening in ${/who knows the city very well/.test(prompt) ? (/You are a local friend in ([^ (]+)/.exec(prompt)?.[1] ?? '?') : '?'}`,
    summary: `TEST mood: ${/Mood: ([^.]+)\./.exec(prompt)?.[1] ?? 'none'}`,
    stops: [
      { time: '19:30', duration_min: 90, kind: 'meal', title: 'TEST dinner', place_name: 'TEST Trattoria', why: 'TEST local food', est_cost: 25, indoor: true },
      { time: '21:15', duration_min: 45, kind: 'walk', title: 'TEST walk', place_name: 'Nowhere Lane', why: 'TEST view', est_cost: 0, indoor: false },
      { time: '22:15', duration_min: 30, kind: 'dessert', title: 'TEST gelato', place_name: 'TEST Gelateria', why: 'TEST sweet', est_cost: 4, indoor: false },
    ],
  };
}

function getaways(prompt) {
  const g = (city, hours, transport, stay, daily, mode = 'train') => ({ city, country_code: 'IT', travel_mode: mode, travel_hours: hours, transport_cost: transport, stay_per_night: stay, daily_spend: daily, highlights: ['TEST a', 'TEST b'], why: `TEST ${city}`, best_season: 'TEST spring' });
  const all = [g('Tivoli', 1, 10, 0, 30, 'bus'), g('Orvieto', 1.3, 20, 60, 40), g('Napoli', 1.2, 50, 70, 50), g('Milano', 3, 90, 120, 80), g('Atlantis', 2, 1, 1, 1)];
  const excluded = /Do not suggest: ([^\n]+)\./.exec(prompt)?.[1]?.split(', ') ?? [];
  return { getaways: all.filter((x) => !excluded.includes(x.city)) };
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
    // Testlerin gönderilen istemleri kontrol edebilmesi için.
    if (req.method === 'GET' && req.url === '/prompts') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(prompts));
    }
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const body = JSON.parse(Buffer.concat(chunks).toString() || '{}');
    const prompt = body.contents?.[0]?.parts?.[0]?.text ?? '';
    prompts.push(prompt);
    const kind = prompt.includes('The traveler says')
      ? 'crisis'
      : prompt.includes('Days to plan')
        ? 'itinerary'
        : prompt.includes('You are a travel translator')
          ? 'image'
          : prompt.includes('plans a short tourism trip')
            ? 'visa'
            : prompt.includes('end-of-trip summary')
              ? 'report'
              : prompt.includes('who knows the city very well')
                ? 'evening'
                : prompt.includes('getaway destinations from')
                  ? 'getaways'
                  : 'other';
    calls.push(kind);
    const payload =
      kind === 'evening'
        ? evening(prompt)
        : kind === 'getaways'
          ? getaways(prompt)
          : kind === 'crisis'
        ? crisis(prompt)
        : kind === 'itinerary'
          ? itinerary(prompt)
          : kind === 'image'
            ? {
                kind: 'menu',
                source_language: 'it',
                summary: `TEST menu translated into ${/into ([A-Za-z ]+)\./.exec(prompt)?.[1] ?? '?'}`,
                items: [
                  { original: 'Cacio e pepe', translated: 'TEST cheese and pepper pasta', note: 'Pecorino, black pepper. Gluten, dairy.', price: '€12', section: 'Primi' },
                  { original: 'Tiramisù', translated: 'TEST tiramisu', note: 'Mascarpone, coffee, egg.', price: '€7', section: 'Dolci' },
                ],
              }
            : kind === 'visa'
              ? {
                  requirement: 'visa_required',
                  max_stay_days: 90,
                  summary: 'TEST Schengen visa required for short stays.',
                  documents: ['TEST passport valid 3 months beyond stay', 'TEST travel insurance'],
                  notes: ['TEST apply at least 15 days before travel'],
                  official_url: 'javascript:alert(1)',
                }
              : kind === 'report'
                ? {
                    summary: `TEST summary: ${/Place ratings: ([^\n]+)/.exec(prompt)?.[1] ?? ''}`,
                    highlights: ['TEST highlight 1', 'TEST highlight 2'],
                    liked: ['history', 'museums', 'casino'],
                    disliked: ['nightlife'],
                    next_trip_tip: 'TEST tip',
                  }
                : { document_type: 'other', items: [] };
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(payload) }] }, finishReason: 'STOP' }] }));
  })
  .listen(PORT, () => console.log(`fake gemini :${PORT}`));
