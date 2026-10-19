// Uzun tarih listelerini eşit parçalara böler; her parça ayrı (paralel) AI çağrısıyla planlanır.

/** `size` günden uzun listeyi, parçalar mümkün olduğunca eşit kalacak biçimde böler. */
export function chunkDates<T>(items: readonly T[], size: number): T[][] {
  if (items.length === 0) return [];
  const parts = Math.max(1, Math.ceil(items.length / Math.max(1, size)));
  const base = Math.floor(items.length / parts);
  const extra = items.length % parts;
  const out: T[][] = [];
  let at = 0;
  for (let i = 0; i < parts; i++) {
    const len = base + (i < extra ? 1 : 0);
    out.push(items.slice(at, at + len));
    at += len;
  }
  return out;
}
