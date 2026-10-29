// Canlı görünümün akış mantığı: yola çık → vardım → bitirdim. Saf fonksiyonlar (arayüz bağımlılığı yok; Deno testleri bunu içe aktarır).

import { endOf, type LiveStop, type StopMarkValue, type StopStatus } from './live-logic.ts';

/** Kullanıcının bir durak için bastığı ara adım: yola çıktı ya da vardı. */
export type StepValue = 'enroute' | 'here';
/** Kartta ve haritada gösterilen durum; ara adımlar da dahil. */
export type FlowStatus = StopStatus | StepValue;

const startOf = (s: LiveStop) => (s.starts_at ? Date.parse(s.starts_at) : NaN);
const running = (s: LiveStop, nowMs: number) => {
  const start = startOf(s);
  const end = endOf(s);
  return Number.isFinite(start) && start <= nowMs && (!Number.isFinite(end) || nowMs < end);
};

/**
 * Şu an odak durak: önce "buradayım" / "yoldayım" dediğin durak, yoksa işaretlenmemiş ilk durak
 * (saati geçmemiş olan), hepsinin saati geçmişse en eskisi. Hepsi işaretliyse null.
 */
export function activeStopIndex(stops: LiveStop[], nowMs: number, marks: Record<string, StopMarkValue>, steps: Record<string, StepValue>): number | null {
  const open = stops.map((s, index) => ({ s, index })).filter(({ s }) => !marks[s.id]);
  if (!open.length) return null;
  const stepped = open.find(({ s }) => steps[s.id] === 'here') ?? open.find(({ s }) => steps[s.id] === 'enroute');
  if (stepped) return stepped.index;
  const notPast = open.find(({ s }) => {
    const end = endOf(s);
    return !Number.isFinite(end) || end > nowMs;
  });
  return (notPast ?? open[0]).index;
}

/** Her durağın durumu: işaret > ara adım > odak durak (şimdi/sıradaki) > geçti/sonra. */
export function flowStatuses(stops: LiveStop[], nowMs: number, marks: Record<string, StopMarkValue>, steps: Record<string, StepValue>): FlowStatus[] {
  const active = activeStopIndex(stops, nowMs, marks, steps);
  return stops.map((s, i) => {
    const mark = marks[s.id];
    if (mark) return mark;
    const step = steps[s.id];
    if (step) return step;
    if (i === active) return running(s, nowMs) ? 'now' : 'next';
    const end = endOf(s);
    return Number.isFinite(end) && end <= nowMs ? 'past' : 'later';
  });
}

/** Gün özeti: gidilen, atlanan, kalan (saati geçip işaretlenmemişler de kalan sayılır). */
export function daySummary(stops: LiveStop[], marks: Record<string, StopMarkValue>): { done: number; skipped: number; left: number; total: number } {
  let done = 0;
  let skipped = 0;
  for (const s of stops) {
    if (marks[s.id] === 'done') done++;
    else if (marks[s.id] === 'skipped') skipped++;
  }
  return { done, skipped, left: stops.length - done - skipped, total: stops.length };
}

/** Gün sonunda işaretlenmemiş her durak "atlandı" olur. Dönen liste atlanacak durak kimlikleridir. */
export function remainingIds(stops: LiveStop[], marks: Record<string, StopMarkValue>): string[] {
  return stops.filter((s) => !marks[s.id]).map((s) => s.id);
}

/** Dakikayı "45 dk" ya da "1 sa 5 dk" biçimine bölmek için parçalar (metni çeviri katmanı kurar). */
export function splitMinutes(min: number): { h: number; m: number } {
  const total = Math.max(0, Math.round(min));
  return { h: Math.floor(total / 60), m: total % 60 };
}

/** Odak durağa kalan (pozitif) ya da geçen (negatif) dakika; saati yoksa null. */
export function minutesTo(startsAt: string | null, nowMs: number): number | null {
  if (!startsAt) return null;
  const start = Date.parse(startsAt);
  return Number.isFinite(start) ? Math.round((start - nowMs) / 60_000) : null;
}

/** Süren durağın bitişine kalan dakika; bitiş (ya da varsayılan süre) yoksa null. */
export function minutesLeft(stop: LiveStop, nowMs: number): number | null {
  const end = endOf(stop);
  return Number.isFinite(end) ? Math.round((end - nowMs) / 60_000) : null;
}
