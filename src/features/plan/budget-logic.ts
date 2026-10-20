export type CostItem = { title: string; estimated_cost: number | null; cost_currency: string | null };

export type DayBudget = {
  /** Kişi başı günlük tahmini toplam (bütçe para biriminde). */
  total: number;
  /** Fiyatı olan kalem sayısı; hiç yoksa uyarı verilmez. */
  priced: number;
  /** Kuru bulunamayan kalem sayısı (toplama katılmaz). */
  skipped: number;
  /** En pahalı kalemler (bütçe para biriminde), azalan sırayla. */
  top: { title: string; amount: number }[];
  status: 'none' | 'ok' | 'near' | 'over';
  /** total / bütçe, 0 ile 1.5 arasına kırpılır. */
  ratio: number;
};

/** Günün kalemlerini bütçe para birimine çevirip bütçeyle karşılaştırır. `rates`: para birimi → bütçe birimine çarpan. */
export function dayBudget(items: CostItem[], budget: number, currency: string, rates: Record<string, number>): DayBudget {
  let total = 0;
  let priced = 0;
  let skipped = 0;
  const converted: { title: string; amount: number }[] = [];
  for (const item of items) {
    if (item.estimated_cost === null || item.estimated_cost <= 0 || !item.cost_currency) continue;
    const code = item.cost_currency.toUpperCase();
    const rate = code === currency.toUpperCase() ? 1 : rates[code];
    if (!rate) {
      skipped++;
      continue;
    }
    const amount = item.estimated_cost * rate;
    total += amount;
    priced++;
    converted.push({ title: item.title, amount });
  }
  const ratio = budget > 0 ? Math.min(total / budget, 1.5) : 0;
  const status = priced === 0 || budget <= 0 ? 'none' : total > budget ? 'over' : total >= budget * 0.85 ? 'near' : 'ok';
  return { total, priced, skipped, top: converted.sort((a, b) => b.amount - a.amount).slice(0, 3), status, ratio };
}
