import { assertEquals } from 'jsr:@std/assert@1';

import { buildAssistantPrompt, normalizeAssistant, tripSummaryForPrompt } from './assistant.ts';

const ctx = { planDates: ['2026-11-02', '2026-11-03', '2026-11-04'], today: '2026-11-02' };

Deno.test('soru olduğu gibi geçer', () => {
  assertEquals(normalizeAssistant({ intent: 'question', reply: 'Uçuşun 10:30.' }, ctx), { intent: 'question', reply: 'Uçuşun 10:30.', date: null, instruction: null, settings: null });
});

Deno.test('gün yeniden planı: geçerli tarih kabul edilir, geçmiş/bilinmeyen tarih other olur', () => {
  const ok = normalizeAssistant({ intent: 'replan_day', reply: 'Tamam', date: '2026-11-03', instruction: 'Daha rahat olsun' }, ctx);
  assertEquals([ok.intent, ok.date, ok.instruction], ['replan_day', '2026-11-03', 'Daha rahat olsun']);
  assertEquals(normalizeAssistant({ intent: 'replan_day', reply: 'x', date: '2026-10-01', instruction: 'a' }, ctx).intent, 'other', 'geçmiş gün');
  assertEquals(normalizeAssistant({ intent: 'replan_day', reply: 'x', date: '2027-01-01', instruction: 'a' }, ctx).intent, 'other', 'plan dışı gün');
  assertEquals(normalizeAssistant({ intent: 'replan_day', reply: 'x', date: '2026-11-03', instruction: '' }, ctx).intent, 'other', 'istek metni yok');
  assertEquals(normalizeAssistant({ intent: 'replan_day', reply: 'x', date: 'yarın', instruction: 'a' }, ctx).intent, 'other', 'tarih biçimi geçersiz');
});

Deno.test('ayar değişikliği: yalnızca geçerli değerler; boşsa other', () => {
  const r = normalizeAssistant({ intent: 'update_settings', reply: 'Güncelledim', settings: { budget_tier: 'lux', companion_type: 'robot', interests: ['müze', '  ', 'x'.repeat(100), 'yemek'] } }, ctx);
  assertEquals(r.intent, 'update_settings');
  assertEquals(r.settings?.budget_tier, 'lux');
  assertEquals(r.settings?.companion_type, undefined, 'geçersiz değer atılır');
  assertEquals(r.settings?.interests?.length, 3);
  assertEquals(normalizeAssistant({ intent: 'update_settings', reply: 'x', settings: { budget_tier: 'ultra' } }, ctx).intent, 'other');
  assertEquals(normalizeAssistant({ intent: 'hack', reply: 'x' }, ctx).intent, 'other');
  assertEquals(normalizeAssistant(null, ctx).reply, '');
});

Deno.test('özet ve istem: seyahat verisi ve tarihler yer alır, tırnak kaçar', () => {
  const summary = tripSummaryForPrompt({
    title: 'Roma',
    ctx: { language: 'tr', start_date: '2026-11-02', end_date: '2026-11-04', companion: 'solo', budget: 'mid', interests: ['müze'], adults: 1, children: 0, currency: 'EUR', destinations: [{ city: 'Roma', country_code: 'IT', arrive_on: '2026-11-02', depart_on: '2026-11-04' }], reservations: [{ id: '1', type: 'flight', title: 'TK1865', starts_at: '2026-11-02T07:30:00Z', ends_at: null, start_timezone: 'Europe/Rome', end_timezone: null, origin_name: 'IST', destination_name: 'FCO', address: null }] },
    activePlan: { days: [{ date: '2026-11-03', city: 'Roma', title: null, notes: null, plan_items: [{ position: 0, kind: 'activity', title: 'Colosseum', description: null, starts_at: '2026-11-03T08:00:00Z', ends_at: null, timezone: 'Europe/Rome', place_name: null, address: null, category: null, estimated_cost: null, cost_currency: null, priority: 3, is_indoor: null, is_locked: false, reservation_id: null, affiliate_partner: null }] }] },
  });
  assertEquals(summary.includes('TK1865 2026-11-02 08:30'), true);
  assertEquals(summary.includes('2026-11-03 Roma: 09:00 Colosseum'), true);
  const prompt = buildAssistantPrompt({ language: 'tr', today: '2026-11-02', message: 'Selam "dünya"', summary, planDates: ctx.planDates });
  assertEquals(prompt.includes("Selam 'dünya'"), true);
  assertEquals(prompt.includes('Turkish'), true);
  assertEquals(prompt.includes('2026-11-03, 2026-11-04'), true);
});
