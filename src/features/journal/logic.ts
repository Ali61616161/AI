// Seyahat günlüğü için saf mantık (arayüz bağımlılığı yok; testlenebilir).

export const JOURNAL_MOODS = ['amazing', 'good', 'ok', 'tired', 'bad'] as const;
export type JournalMood = (typeof JOURNAL_MOODS)[number];
export const MOOD_ICONS: Record<JournalMood, 'happy' | 'happy-outline' | 'remove-circle-outline' | 'moon-outline' | 'sad-outline'> = {
  amazing: 'happy',
  good: 'happy-outline',
  ok: 'remove-circle-outline',
  tired: 'moon-outline',
  bad: 'sad-outline',
};

export const MAX_PHOTOS = 4;
export const MAX_NOTE = 2000;
export const MAX_PLACES = 6;
export const PROMPT_COUNT = 6;

/** Günün yazma ipucu: tarihe göre döner (her gün farklı, aynı gün aynı). */
export function promptIndex(date: string): number {
  const n = Number(date.replace(/-/g, '')) || 0;
  return n % PROMPT_COUNT;
}
const MAX_DAYS = 90;

export type JournalEntry = {
  id: string;
  trip_id: string;
  entry_date: string;
  note: string;
  mood: JournalMood | null;
  photos: string[];
  places: string[];
};

export const isMood = (v: unknown): v is JournalMood => typeof v === 'string' && (JOURNAL_MOODS as readonly string[]).includes(v);

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Günlük yazılabilecek günler: seyahatin ilk gününden bugüne (bitiş tarihi geçtiyse bitişe) kadar.
 * Henüz başlamamış seyahatte boş döner; çok uzun aralıklar son `MAX_DAYS` günle sınırlanır.
 */
export function journalDays(start: string | null, end: string | null, today: string): string[] {
  if (!start || start > today) return [];
  const last = end && end < today ? end : today;
  const days: string[] = [];
  for (let d = start; d <= last && days.length < 366; d = addDays(d, 1)) days.push(d);
  return days.slice(-MAX_DAYS);
}

/** Kovadaki dosya yolu: <kullanıcı>/<seyahat>/<rastgele>.jpg (veritabanındaki kural bu biçimi şart koşar). */
export function photoPath(userId: string, tripId: string, id: string): string {
  return `${userId}/${tripId}/${id}.jpg`;
}

/** Günlük özeti ve paylaşım kartı için: kaç gün yazıldı, kaç fotoğraf var. */
export function journalStats(entries: JournalEntry[]): { days: number; photos: number; places: number } {
  return { days: entries.length, photos: entries.reduce((n, e) => n + e.photos.length, 0), places: new Set(entries.flatMap((e) => e.places)).size };
}

/** Kayıt boşsa (not, ruh hali ve fotoğraf yok) silinmesi gerekir. */
export const isEmptyEntry = (e: { note: string; mood: JournalMood | null; photos: string[]; places?: string[] }) => e.note.trim() === '' && e.mood === null && e.photos.length === 0 && (e.places?.length ?? 0) === 0;
