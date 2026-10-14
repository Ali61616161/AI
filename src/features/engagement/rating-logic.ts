// Puan isteme kararı (saf fonksiyon; testlenebilir). Kullanıcı memnun kaldığı birkaç
// andan sonra, kurulumdan en az 2 gün geçtiyse ve son istekten 120 gün geçtiyse sorulur.
// Apple ayrıca yılda en fazla 3 gösterim yapar; çağırmak her zaman pencere açmaz.

export type RatingState = { moments: number; firstSeen: number; lastAsked: number | null };

const DAY = 86_400_000;
export const MIN_MOMENTS = 3;
export const MIN_AGE_DAYS = 2;
export const COOLDOWN_DAYS = 120;

export function shouldAskForRating(state: RatingState, now: number): boolean {
  if (state.moments < MIN_MOMENTS) return false;
  if (now - state.firstSeen < MIN_AGE_DAYS * DAY) return false;
  return state.lastAsked === null || now - state.lastAsked >= COOLDOWN_DAYS * DAY;
}
