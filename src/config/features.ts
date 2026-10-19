/**
 * Yayındaki özellikler. İlk sürümde uygulama iki işe odaklanır: (1) bilet/otelden otomatik seyahat planı
 * ve (2) seyahat sırasında canlı rehber. Diğerleri kodda durur ama girişleri kapalıdır; talebe göre
 * sonraki güncellemelerde açılır.
 */
export const Features = {
  /** Çark çevir (nereye gitsem). */
  spin: false,
  /** Kararsız mısın? (yakında açık yer seç). */
  decide: false,
  /** Kaçamak (birkaç saat ötede ucuz rotalar). */
  getaway: false,
  /** Kaydedilen yerler (Listelerim) ve Şehir pasaportu. */
  savedPlaces: false,
  /** Gezginler (sosyal mod): tek başına gezenler için açık. */
  social: true,
  /** Arkadaşını davet et. */
  referral: false,
} as const;
