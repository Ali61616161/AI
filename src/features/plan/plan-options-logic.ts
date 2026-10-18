// Plan tercihlerinin saf mantığı (arayüz bağımlılığı yok; Deno testleri bunu içe aktarır).
// Sunucu tarafında sanitizePlanOptions (supabase/functions/_shared/itinerary.ts) yeniden doğrular.

export type PlanOptions = {
  pace?: 'relaxed' | 'balanced' | 'packed';
  diets?: ('vegetarian' | 'vegan' | 'halal' | 'gluten_free')[];
  step_free?: boolean;
  interests?: string[];
  notes?: string;
};
/** İki ilgi alanı listesi aynı mı (sıra önemsiz). */
export function sameInterests(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
}

/** Form durumundan sunucuya gidecek seçenekler; boş ve varsayılan olanlar gönderilmez. */
export function buildPlanOptions(form: {
  pace: PlanOptions['pace'] | null;
  diets: string[];
  stepFree: boolean;
  interests: string[];
  profileInterests: string[];
  notes: string;
}): PlanOptions {
  const options: PlanOptions = {};
  if (form.pace && form.pace !== 'balanced') options.pace = form.pace;
  if (form.diets.length) options.diets = form.diets as PlanOptions['diets'];
  if (form.stepFree) options.step_free = true;
  if (form.interests.length && !sameInterests(form.interests, form.profileInterests)) options.interests = form.interests;
  const notes = form.notes.trim();
  if (notes) options.notes = notes.slice(0, 300);
  return options;
}
