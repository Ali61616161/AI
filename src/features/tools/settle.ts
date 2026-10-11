// Hesap bölüşme: kim ne ödedi, kimin payı ne kadar → kim kime ne kadar ödemeli.

export type SplitExpense = { paidBy: string; amount: number; shares: { name: string; amount: number }[] };
export type Transfer = { from: string; to: string; amount: number };

const round = (n: number) => Math.round(n * 100) / 100;

/** Tutarı kişiler arasında kuruşu kuruşuna eşit böler (artan kuruşlar ilk kişilere). */
export function equalShares(amount: number, names: string[]): { name: string; amount: number }[] {
  if (names.length === 0) return [];
  const cents = Math.round(amount * 100);
  const base = Math.floor(cents / names.length);
  const extra = cents - base * names.length;
  return names.map((name, i) => ({ name, amount: (base + (i < extra ? 1 : 0)) / 100 }));
}

/** Kişi başına bakiye: pozitif = alacaklı, negatif = borçlu. */
export function balances(expenses: SplitExpense[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const e of expenses) {
    out[e.paidBy] = round((out[e.paidBy] ?? 0) + e.amount);
    for (const s of e.shares) out[s.name] = round((out[s.name] ?? 0) - s.amount);
  }
  return out;
}

/** En az sayıda transferle borçları kapatır (açgözlü eşleştirme). */
export function settle(expenses: SplitExpense[]): Transfer[] {
  const b = balances(expenses);
  const creditors = Object.entries(b).filter(([, v]) => v > 0.004).map(([name, v]) => ({ name, v })).sort((x, y) => y.v - x.v);
  const debtors = Object.entries(b).filter(([, v]) => v < -0.004).map(([name, v]) => ({ name, v: -v })).sort((x, y) => y.v - x.v);
  const transfers: Transfer[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = round(Math.min(debtors[i].v, creditors[j].v));
    if (amount > 0) transfers.push({ from: debtors[i].name, to: creditors[j].name, amount });
    debtors[i].v = round(debtors[i].v - amount);
    creditors[j].v = round(creditors[j].v - amount);
    if (debtors[i].v <= 0.004) i++;
    if (creditors[j].v <= 0.004) j++;
  }
  return transfers;
}
