// Seyahate hazırlık listesinin saf mantığı (arayüz bağımlılığı yok; Deno testleri bunu içe aktarır).

export type ReadinessInput = {
  hasFlightOrTransport: boolean;
  hasHotel: boolean;
  hasPlan: boolean;
  hasFlightTimes: boolean;
  /** Seyahatin ilk gününe kalan gün; geçmişse negatif. */
  daysUntilStart: number | null;
};

export type ReadinessKey = 'ticket' | 'hotel' | 'plan' | 'times';
export type ReadinessItem = { key: ReadinessKey; done: boolean };

/** Hazırlık maddeleri; uçuş saati sadece biletten gelmiyorsa sorulur. */
export function readinessItems(i: ReadinessInput): ReadinessItem[] {
  return [
    { key: 'ticket', done: i.hasFlightOrTransport },
    { key: 'hotel', done: i.hasHotel },
    { key: 'plan', done: i.hasPlan },
    { key: 'times', done: i.hasFlightTimes || i.hasFlightOrTransport },
  ];
}

export function readinessProgress(items: ReadinessItem[]): { done: number; total: number } {
  return { done: items.filter((x) => x.done).length, total: items.length };
}
