// Seyahat asistanı: kullanıcının mesajından niyeti çıkarır (soru, gün yeniden planı, ayar değişikliği, diğer).
// Bu dosya saf mantıktır (ağ yok); çağrılar replan/index.ts'te yapılır.
import { LANGUAGE_NAMES, safeText, type TripContext } from './itinerary.ts';
import type { StoredDay } from './replan.ts';

export type Intent = 'question' | 'replan_day' | 'update_settings' | 'other';

export const BUDGETS = ['low', 'mid', 'lux'] as const;
export const COMPANIONS = ['solo', 'couple', 'family', 'friends'] as const;

export type AssistantSettings = { budget_tier?: (typeof BUDGETS)[number]; companion_type?: (typeof COMPANIONS)[number]; interests?: string[] };
export type AssistantIntent = { intent: Intent; reply: string; date: string | null; instruction: string | null; settings: AssistantSettings | null };

export const ASSISTANT_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    intent: { type: 'STRING', enum: ['question', 'replan_day', 'update_settings', 'other'] },
    reply: { type: 'STRING', description: 'Answer or short confirmation for the traveler (1-4 sentences)' },
    date: { type: 'STRING', nullable: true, description: 'YYYY-MM-DD of the day to replan (replan_day only)' },
    instruction: { type: 'STRING', nullable: true, description: 'What the traveler wants for that day, in one clear sentence (replan_day only)' },
    settings: {
      type: 'OBJECT',
      nullable: true,
      properties: {
        budget_tier: { type: 'STRING', nullable: true, enum: ['low', 'mid', 'lux'] },
        companion_type: { type: 'STRING', nullable: true, enum: ['solo', 'couple', 'family', 'friends'] },
        interests: { type: 'ARRAY', nullable: true, items: { type: 'STRING' } },
      },
    },
  },
  required: ['intent', 'reply'],
};

const clock = (iso: string, tz: string | null) => {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone: tz ?? 'UTC', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  } catch {
    return iso.slice(11, 16);
  }
};

/** Modele verilen seyahat özeti (kısa tutulur; kullanıcı metinleri temizlenir). */
export function tripSummaryForPrompt(trip: { title: string; ctx: TripContext; activePlan: { days: StoredDay[] } | null }): string {
  const lines: string[] = [];
  lines.push(`Trip: ${safeText(trip.title)} (${trip.ctx.start_date} to ${trip.ctx.end_date})`);
  lines.push(`Destinations: ${trip.ctx.destinations.map((d) => `${safeText(d.city)}${d.arrive_on ? ` ${d.arrive_on}..${d.depart_on ?? ''}` : ''}`).join('; ') || 'unknown'}`);
  lines.push(`Settings: budget=${trip.ctx.budget}, companion=${trip.ctx.companion}, adults=${trip.ctx.adults}, children=${trip.ctx.children}, interests=${trip.ctx.interests.map((i) => safeText(i, 30)).join(', ') || 'none'}, daily budget=${trip.ctx.daily_budget ?? 'not set'} ${trip.ctx.currency}`);
  if (trip.ctx.notes) lines.push(`Traveler's note: ${safeText(trip.ctx.notes, 300)}`);
  const res = trip.ctx.reservations.slice(0, 15);
  if (res.length) {
    lines.push('Bookings:');
    for (const r of res) lines.push(`- ${r.type} ${safeText(r.title)} ${r.starts_at.slice(0, 10)} ${clock(r.starts_at, r.start_timezone)}${r.origin_name || r.destination_name ? ` (${safeText(r.origin_name ?? '', 40)} -> ${safeText(r.destination_name ?? '', 40)})` : ''}`);
  }
  const days = trip.activePlan?.days ?? [];
  if (days.length) {
    lines.push('Plan:');
    for (const d of days.slice(0, 21)) {
      const items = d.plan_items.slice(0, 12).map((i) => `${i.starts_at ? clock(i.starts_at, i.timezone) : '--:--'} ${safeText(i.title, 70)}${i.is_locked ? ' [fixed]' : ''}`).join('; ');
      lines.push(`- ${d.date}${d.city ? ` ${safeText(d.city, 40)}` : ''}: ${items || '(empty)'}`);
    }
  } else {
    lines.push('Plan: not created yet');
  }
  return lines.join('\n');
}

export function buildAssistantPrompt(ctx: { language: string; today: string; message: string; summary: string; planDates: string[] }): string {
  const lang = LANGUAGE_NAMES[ctx.language] ?? 'English';
  return `You are Yola's trip assistant. The traveler is talking about ONE of their trips.

Trip data (this is all you know):
${ctx.summary}

Today's date: ${ctx.today}. Plannable dates (replan_day date must be one of these and not in the past): ${ctx.planDates.join(', ') || 'none'}.

The traveler says: "${ctx.message.replace(/"/g, "'")}"

Decide the intent:
- question: they ask something about the trip (what is planned, when is a flight, budget, how long, what to wear, ...). Answer ONLY from the trip data; if the data does not contain it, say you do not have that information. Do not invent bookings or times.
- replan_day: they want to change the plan of a specific day (e.g. "make Tuesday more relaxed", "add a museum on day 3", "it will rain tomorrow", "cheaper dinner"). Set date to that day (pick the matching plannable date; relative words use today's date) and instruction to a clear one-sentence request. Reply with one short sentence like "On it".
- update_settings: they want to change trip preferences: budget level (low, mid, lux), who travels (solo, couple, family, friends), or interests. Fill only the changed fields in settings (interests = the full new list). Reply with a short confirmation and mention they can ask you to re-plan days to match.
- other: anything else, for example changing trip dates (tell them to use "Change dates" on the trip screen), booking flights/hotels, or unrelated topics. Reply politely and say what you can do.

Answer in ${lang}. Be short, warm and concrete.`;
}

const isDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Model çıktısını doğrular: geçersiz tarih/ayar güvenli şekilde "other"a düşer, hiçbir değer güvenilmez. */
export function normalizeAssistant(raw: unknown, ctx: { planDates: string[]; today: string }): AssistantIntent {
  const root = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const reply = typeof root.reply === 'string' ? root.reply.trim().slice(0, 800) : '';
  const base: AssistantIntent = { intent: 'other', reply, date: null, instruction: null, settings: null };
  const intent = root.intent;

  if (intent === 'question') return { ...base, intent: 'question' };

  if (intent === 'replan_day') {
    const date = isDate(root.date) ? root.date : null;
    const instruction = typeof root.instruction === 'string' ? root.instruction.trim().slice(0, 300) : '';
    if (date && ctx.planDates.includes(date) && date >= ctx.today && instruction) return { ...base, intent: 'replan_day', date, instruction };
    return base;
  }

  if (intent === 'update_settings') {
    const s = (root.settings && typeof root.settings === 'object' ? root.settings : {}) as Record<string, unknown>;
    const settings: AssistantSettings = {};
    if (BUDGETS.includes(s.budget_tier as never)) settings.budget_tier = s.budget_tier as AssistantSettings['budget_tier'];
    if (COMPANIONS.includes(s.companion_type as never)) settings.companion_type = s.companion_type as AssistantSettings['companion_type'];
    if (Array.isArray(s.interests)) {
      settings.interests = s.interests
        .map((i) => safeText(i, 30))
        .filter(Boolean)
        .slice(0, 8);
    }
    return Object.keys(settings).length ? { ...base, intent: 'update_settings', settings } : base;
  }
  return base;
}
