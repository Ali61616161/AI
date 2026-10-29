// Seyahat adı denetimi (saf; testlenebilir).

const norm = (s: string) => s.trim().toLocaleLowerCase();

/** Aynı kullanıcının başka bir seyahati aynı adı taşıyor mu? (büyük/küçük harf ve baş/son boşluk fark etmez) */
export function isDuplicateTripName(trips: readonly { owner_id: string; title: string; status?: string }[] | undefined, title: string, ownerId: string | null): boolean {
  const wanted = norm(title);
  if (!wanted || !ownerId) return false;
  return (trips ?? []).some((t) => t.owner_id === ownerId && t.status !== 'cancelled' && norm(t.title) === wanted);
}

/** Sunucunun "aynı ad" hatası mı (veritabanı tetikleyicisi). */
export function isDuplicateNameError(error: unknown): boolean {
  const e = error as { message?: unknown; code?: unknown } | null;
  return typeof e?.message === 'string' && e.message.includes('duplicate_trip_title');
}

/** Asistan gibi "yalnızca güncel/gelecek seyahatler" listeleri için: bitiş tarihi geçmemiş olanlar. */
export function isCurrentOrFuture(trip: { start_date: string | null; end_date: string | null }, today: string): boolean {
  const last = trip.end_date ?? trip.start_date;
  return last === null || last >= today;
}

/** Belgelerden kurulan seyahatte ad çakışırsa " (2)", " (3)"… ekleyerek benzersiz yapar. */
export function uniqueTripTitle(trips: readonly { owner_id: string; title: string; status?: string }[] | undefined, title: string, ownerId: string | null): string {
  if (!isDuplicateTripName(trips, title, ownerId)) return title;
  for (let n = 2; n < 100; n++) {
    const candidate = `${title} (${n})`;
    if (!isDuplicateTripName(trips, candidate, ownerId)) return candidate;
  }
  return title;
}
