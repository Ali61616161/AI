// "Planı Değiştir" ve tarih değişikliğinin ortak kodu. Dış paket kullanmaz;
// Edge Function, uygulama ve Deno testleri aynı kodu çalıştırır.
import { localToUtcIso, utcToLocal } from './documents.ts';
import {
  aiItem,
  BUDGET_RULES,
  COMPANION_RULES,
  defaultFixedDuration,
  LANGUAGE_NAMES,
  minutesInDay,
  overlaps,
  toMinutes,
  type BudgetTier,
  type Companion,
  type PlanItem,
  type TripReservation,
} from './itinerary.ts';

/** Veritabanındaki plan kalemi (PostgREST'ten okunduğu haliyle). */
export type StoredItem = {
  position: number;
  kind: PlanItem['kind'];
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  timezone: string | null;
  place_name: string | null;
  address: string | null;
  category: string | null;
  estimated_cost: number | null;
  cost_currency: string | null;
  priority: number;
  is_indoor: boolean | null;
  is_locked: boolean;
  reservation_id: string | null;
  affiliate_partner: string | null;
};

export type StoredDay = {
  date: string;
  city: string | null;
  title: string | null;
  notes: string | null;
  plan_items: StoredItem[];
};

/** save_plan_version'a gönderilecek gün. */
export type PayloadDay = {
  date: string;
  city: string | null;
  title: string | null;
  notes: string | null;
  items: (Omit<StoredItem, 'position'> & { position: number })[];
};

/** Kayıtlı bir günü olduğu gibi yeni sürüme kopyalanabilecek biçime çevirir. */
export function storedDayToPayload(day: StoredDay): PayloadDay {
  return {
    date: day.date,
    city: day.city,
    title: day.title,
    notes: day.notes,
    items: [...day.plan_items]
      .sort((a, b) => a.position - b.position)
      .map((item, position) => ({ ...item, position })),
  };
}

// ---------------------------------------------------------------------------
// Tarih değişikliği analizi
// ---------------------------------------------------------------------------

export type DateChangeAnalysis = {
  removedDates: string[];
  addedDates: string[];
  /** Yeni tarihlerin dışında kalan rezervasyonlar; silinmez, kullanıcı uyarılır. */
  reservationsOutside: { id: string; title: string; date: string }[];
  /** Hiçbir otel rezervasyonunun kapsamadığı geceler (son gün hariç). */
  uncoveredNights: string[];
  /** Çıkan günlerdeki öne çıkan (öncelik ≥ 4) ve kilitli olmayan duraklar. */
  removedHighlights: { date: string; title: string }[];
};

const daysBetween = (start: string, end: string) => {
  const out: string[] = [];
  for (let t = Date.parse(`${start}T00:00:00Z`); t <= Date.parse(`${end}T00:00:00Z`); t += 86_400_000) {
    out.push(new Date(t).toISOString().slice(0, 10));
  }
  return out;
};

export function analyzeDateChange(input: {
  oldStart: string;
  oldEnd: string;
  newStart: string;
  newEnd: string;
  reservations: TripReservation[];
  planDays: StoredDay[];
}): DateChangeAnalysis {
  const oldDates = daysBetween(input.oldStart, input.oldEnd);
  const newDates = daysBetween(input.newStart, input.newEnd);
  const removedDates = oldDates.filter((d) => !newDates.includes(d));
  const addedDates = newDates.filter((d) => !oldDates.includes(d));

  const reservationsOutside = input.reservations
    .map((r) => ({ id: r.id, title: r.title, date: utcToLocal(r.starts_at, r.start_timezone).slice(0, 10) }))
    .filter((r) => r.date < input.newStart || r.date > input.newEnd);

  const hotelNights = new Set<string>();
  for (const r of input.reservations) {
    if (r.type !== 'hotel' || !r.ends_at) continue;
    const checkIn = utcToLocal(r.starts_at, r.start_timezone).slice(0, 10);
    const checkOut = utcToLocal(r.ends_at, r.end_timezone ?? r.start_timezone).slice(0, 10);
    for (const d of daysBetween(checkIn, checkOut).slice(0, -1)) hotelNights.add(d);
  }
  const hasHotels = input.reservations.some((r) => r.type === 'hotel');
  // Otel rezervasyonu hiç yoksa kullanıcı konaklamayı kendisi ayarlamıştır; uyarı vermeyiz.
  const uncoveredNights = hasHotels ? newDates.slice(0, -1).filter((d) => !hotelNights.has(d)) : [];

  const removedHighlights = input.planDays
    .filter((day) => removedDates.includes(day.date))
    .flatMap((day) => day.plan_items.filter((i) => !i.is_locked && i.priority >= 4).map((i) => ({ date: day.date, title: i.title })));

  return { removedDates, addedDates, reservationsOutside, uncoveredNights, removedHighlights };
}

/** Kısaltmada mevcut planı ve korunacak yerleri AI'a anlatan ek kurallar. */
export function shortenRules(currentDays: StoredDay[], keepDates: string[], highlights: { title: string }[]): string[] {
  const rules = ['The trip got shorter. Replan these days, changing the current plan as little as possible.'];
  const current = currentDays
    .filter((d) => keepDates.includes(d.date))
    .map((d) => `${d.date}: ${d.plan_items.filter((i) => !i.is_locked).map((i) => i.title).join(', ') || '(empty)'}`);
  if (current.length) rules.push(`Current plan: ${current.join(' | ')}`);
  if (highlights.length) {
    rules.push(`These highlights were on removed days; fit as many as possible into the remaining days: ${highlights.map((h) => h.title).join(', ')}`);
  }
  return rules;
}

// ---------------------------------------------------------------------------
// Anlık durum (kriz) yeniden planlaması
// ---------------------------------------------------------------------------

export type CrisisContext = {
  language: string;
  message: string;
  /** Yerel tarih ve saat, YYYY-MM-DDTHH:mm. */
  localNow: string;
  timezone: string;
  location: { lat: number; lng: number } | null;
  city: string | null;
  budget: BudgetTier;
  companion: Companion;
  interests: string[];
  currency: string;
  /** Günün henüz yapılmamış, değiştirilebilir durakları. */
  remaining: { time: string; title: string; place: string | null }[];
  /** Günün kalanındaki kilitli duraklar (uçuş, otel girişi...). */
  fixedLater: { time: string; title: string }[];
};

export const CRISIS_RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    reply: { type: 'STRING', description: '2-4 short sentences answering the traveler' },
    change_plan: { type: 'BOOLEAN', description: "true if the rest of today's plan should be replaced" },
    items: {
      type: 'ARRAY',
      description: 'New plan for the rest of today (or suggestions if there is no plan)',
      items: {
        type: 'OBJECT',
        properties: {
          start_time: { type: 'STRING', description: 'HH:mm local time' },
          end_time: { type: 'STRING', nullable: true },
          kind: { type: 'STRING', enum: ['activity', 'meal', 'transport', 'free_time'] },
          title: { type: 'STRING' },
          description: { type: 'STRING', nullable: true, description: 'Why this fits the situation, one sentence' },
          place_name: { type: 'STRING', nullable: true },
          address: { type: 'STRING', nullable: true },
          category: { type: 'STRING', nullable: true },
          estimated_cost: { type: 'NUMBER', nullable: true },
          currency: { type: 'STRING', nullable: true },
          priority: { type: 'INTEGER' },
          is_indoor: { type: 'BOOLEAN' },
          booking: { type: 'STRING', enum: ['getyourguide', 'tiqets', 'none'] },
        },
        required: ['start_time', 'kind', 'title', 'priority'],
      },
    },
  },
  required: ['reply', 'change_plan', 'items'],
};

export function buildCrisisPrompt(ctx: CrisisContext): string {
  const where = ctx.location
    ? `${ctx.location.lat.toFixed(4)}, ${ctx.location.lng.toFixed(4)}${ctx.city ? ` (${ctx.city})` : ''}`
    : ctx.city ?? 'unknown';
  const remaining = ctx.remaining.length ? ctx.remaining.map((r) => `${r.time} ${r.title}${r.place ? ` @ ${r.place}` : ''}`).join('; ') : 'nothing planned';
  const fixed = ctx.fixedLater.length ? ctx.fixedLater.map((f) => `${f.time} ${f.title}`).join('; ') : 'none';

  return `You are a travel assistant helping a traveler who is on their trip right now.

The traveler says: "${ctx.message.replace(/"/g, "'")}"

Situation:
- Local time: ${ctx.localNow.replace('T', ' ')} (${ctx.timezone})
- Location: ${where}
- Remaining plan today: ${remaining}
- Fixed bookings later today (must keep, leave time to reach them): ${fixed}
- ${BUDGET_RULES[ctx.budget]}
- ${COMPANION_RULES[ctx.companion]}
- Interests: ${ctx.interests.join(', ') || 'general sightseeing'}

What to do:
- Answer in ${LANGUAGE_NAMES[ctx.language] ?? 'English'}: short, warm and concrete.
- If the situation affects today's plan (weather, delay, closure, fatigue, budget, time gap), set change_plan true and give a new plan for the rest of today in items. Start no earlier than 15 minutes from now and keep every fixed booking reachable.
- If it is only a question, set change_plan false and put 1-4 suggestions in items.
- Prefer places within about 1 km or a short transit ride from the location. If it is raining or cold, prefer is_indoor places.
- Only suggest real places you are confident exist; otherwise name an area or street.
- estimated_cost per person in local currency with its ISO 4217 code; titles and descriptions in ${LANGUAGE_NAMES[ctx.language] ?? 'English'}; keep place_name in its local name.`;
}

export function normalizeCrisis(raw: unknown, options: { nowTime: string; currency: string }): { reply: string; changePlan: boolean; items: PlanItem[] } {
  const root = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const reply = typeof root.reply === 'string' && root.reply.trim() ? root.reply.trim().slice(0, 800) : '';
  const now = toMinutes(options.nowTime);
  const items = (Array.isArray(root.items) ? root.items : [])
    .slice(0, 12)
    .map((i) => aiItem(i, options.currency))
    .filter((i): i is PlanItem => i !== null && toMinutes(i.start_time) >= now)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  return { reply, changePlan: root.change_plan === true && items.length > 0, items };
}

/**
 * Günün planında "şu andan sonrası"nı yenisiyle değiştirir. Başlamış veya geçmiş
 * duraklar ve kilitli duraklar korunur; kilitli durakla çakışan yeni öneriler atılır.
 */
export function replaceRestOfDay(day: StoredDay, nowUtc: string, newItems: PlanItem[], dayTz: string): PayloadDay {
  const kept = day.plan_items.filter((i) => i.is_locked || !i.starts_at || i.starts_at < nowUtc);
  const lockedLater = kept.filter((i) => i.is_locked && i.starts_at && i.starts_at >= nowUtc);
  const windows = lockedLater.map((i) => {
    const local = utcToLocal(i.starts_at!, i.timezone ?? dayTz);
    const startMin = minutesInDay(day.date, local.slice(11), i.timezone ?? dayTz, dayTz);
    const endLocal = i.ends_at ? utcToLocal(i.ends_at, i.timezone ?? dayTz) : null;
    const endMin = endLocal ? minutesInDay(day.date, endLocal.slice(11), i.timezone ?? dayTz, dayTz) : startMin + defaultFixedDuration(i.kind);
    return [startMin - (i.kind === 'transport' ? 120 : 0), endMin] as [number, number];
  });

  const added = newItems
    .filter((i) => !windows.some((w) => overlaps(w, [toMinutes(i.start_time), i.end_time ? toMinutes(i.end_time) : toMinutes(i.start_time) + 30])))
    .map((i) => ({
      kind: i.kind,
      title: i.title,
      description: i.description,
      starts_at: localToUtcIso(`${day.date}T${i.start_time}`, dayTz),
      ends_at: i.end_time ? localToUtcIso(`${day.date}T${i.end_time}`, dayTz) : null,
      timezone: dayTz,
      place_name: i.place_name,
      address: i.address,
      category: i.category,
      estimated_cost: i.estimated_cost,
      cost_currency: i.currency,
      priority: i.priority,
      is_indoor: i.is_indoor,
      is_locked: false,
      reservation_id: null,
      affiliate_partner: i.booking_partner,
    }));

  const items = [...kept.map(({ position: _p, ...rest }) => rest), ...added]
    .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''))
    .map((item, position) => ({ ...item, position }));
  return { date: day.date, city: day.city, title: day.title, notes: day.notes, items };
}

// ---------------------------------------------------------------------------
// Sürüm karşılaştırma
// ---------------------------------------------------------------------------

export type DayDiff = { date: string; added: string[]; removed: string[] };

/** İki plan arasındaki farklar: tarih bazında eklenen ve çıkan durak başlıkları. */
export function diffPlans(from: StoredDay[], to: StoredDay[]): DayDiff[] {
  const titles = (days: StoredDay[], date: string) =>
    days.find((d) => d.date === date)?.plan_items.map((i) => i.title) ?? [];
  const dates = [...new Set([...from.map((d) => d.date), ...to.map((d) => d.date)])].sort();
  return dates
    .map((date) => {
      const a = titles(from, date);
      const b = titles(to, date);
      return { date, added: b.filter((t) => !a.includes(t)), removed: a.filter((t) => !b.includes(t)) };
    })
    .filter((d) => d.added.length || d.removed.length);
}
