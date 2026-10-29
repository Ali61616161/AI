// Plan metinlerinin çevirisi: hangi metinler çevrilir, toplu istek parçaları, sonucun plana uygulanması.
// Saf mantık (ağ yok); translate-plan işlevi ve uygulama aynı kodu kullanır. Yer adları ve adresler çevrilmez.

export type PlanTextItem = { id: string; title: string; description: string | null };
export type PlanTextDay = { id: string; title: string | null; notes: string | null; plan_items: PlanTextItem[] };
export type PlanText = { summary: string | null; day_plans: PlanTextDay[] };

/** Bir planın çevirisi: metinler kimliklerine göre. `same`: plan zaten bu dilde, çeviri gerekmedi. */
export type PlanTranslation = {
  same?: boolean;
  summary?: string;
  days?: Record<string, { title?: string; notes?: string }>;
  items?: Record<string, { title?: string; description?: string }>;
};

export const MAX_PLAN_CHARS = 60_000;
const MAX_ONE = 2000;

const clean = (v: string | null | undefined): string | null => {
  const t = typeof v === 'string' ? v.trim() : '';
  return t ? t.slice(0, MAX_ONE) : null;
};

/** Çevrilecek benzersiz metinler (özet, gün başlığı/notu, kalem başlığı/açıklaması), toplam sınırı aşmayacak kadar. */
export function collectStrings(plan: PlanText): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  let total = 0;
  const add = (v: string | null | undefined) => {
    const t = clean(v);
    if (!t || seen.has(t) || total + t.length > MAX_PLAN_CHARS) return;
    seen.add(t);
    out.push(t);
    total += t.length;
  };
  add(plan.summary);
  for (const d of plan.day_plans) {
    add(d.title);
    add(d.notes);
    for (const i of d.plan_items) {
      add(i.title);
      add(i.description);
    }
  }
  return out;
}

/** Metinleri Google'a gidecek parçalara böler (istek başına en çok `maxItems` metin ve `maxChars` karakter). */
export function chunkStrings(list: string[], maxItems = 100, maxChars = 20_000): string[][] {
  const chunks: string[][] = [];
  let cur: string[] = [];
  let chars = 0;
  for (const s of list) {
    if (cur.length > 0 && (cur.length >= maxItems || chars + s.length > maxChars)) {
      chunks.push(cur);
      cur = [];
      chars = 0;
    }
    cur.push(s);
    chars += s.length;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" };

/** Çeviri servisi bazen kesme işaretini vb. HTML karakter koduyla döner; düz metne çevrilir. */
export function decodeEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|apos|#39);/g, (m) => ENTITIES[m] ?? m);
}

/** Çevrilmiş metinlerden (özgün metin → çeviri) kimliklere göre çeviri kaydı kurar. */
export function buildTranslation(plan: PlanText, translated: ReadonlyMap<string, string>): PlanTranslation {
  const tr = (v: string | null | undefined): string | undefined => {
    const t = clean(v);
    return t ? translated.get(t) : undefined;
  };
  const out: PlanTranslation = { summary: tr(plan.summary), days: {}, items: {} };
  for (const d of plan.day_plans) {
    const day = { title: tr(d.title), notes: tr(d.notes) };
    if (day.title || day.notes) out.days![d.id] = day;
    for (const i of d.plan_items) {
      const item = { title: tr(i.title), description: tr(i.description) };
      if (item.title || item.description) out.items![i.id] = item;
    }
  }
  return out;
}

/** Çeviriyi plana uygular: çevirisi olan alanlar değişir, diğerleri (yer adı, adres, saat…) olduğu gibi kalır. */
export function applyTranslation<T extends PlanText>(plan: T, tr: PlanTranslation | null | undefined): T {
  if (!tr || tr.same) return plan;
  return {
    ...plan,
    summary: tr.summary ?? plan.summary,
    day_plans: plan.day_plans.map((d) => {
      const dt = tr.days?.[d.id];
      return {
        ...d,
        title: dt?.title ?? d.title,
        notes: dt?.notes ?? d.notes,
        plan_items: d.plan_items.map((i) => {
          const it = tr.items?.[i.id];
          return it ? { ...i, title: it.title ?? i.title, description: it.description ?? i.description } : i;
        }),
      };
    }),
  };
}

/** Algılanan kaynak dili hedefle aynı olan metinlerin karakter payı; yüksekse plan zaten bu dildedir. */
export function sameLanguageShare(items: { text: string; detected: string | null }[], target: string): number {
  const base = (l: string) => l.toLowerCase().split('-')[0];
  let all = 0;
  let same = 0;
  for (const i of items) {
    all += i.text.length;
    if (i.detected && base(i.detected) === base(target)) same += i.text.length;
  }
  return all === 0 ? 1 : same / all;
}
