// "İl, İlçe" gösterimi için saf mantık (arayüz bağımlılığı yok; testlenebilir).

type Address = { city?: string | null; subregion?: string | null; region?: string | null };

/** İl (bölge) önce, sonra ilçe; aynı adlar tekrarlanmaz: "İstanbul, Kadıköy". */
export function cityLabel(place: Address | null | undefined): string | null {
  const names = [place?.region, place?.city ?? place?.subregion]
    .map((n) => n?.trim())
    .filter((n, i, all): n is string => !!n && all.findIndex((x) => x?.toLowerCase() === n.toLowerCase()) === i);
  return names.length ? names.join(', ') : null;
}

/** Zaten "İl, İlçe" biçiminde mi? */
export const hasRegion = (label: string | null | undefined) => !!label && label.includes(',');
