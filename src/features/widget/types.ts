/** "Bugünün planı" widget'ına uygulamadan gönderilen, önceden çevrilmiş içerik. */
export type TodaysPlanWidgetItem = {
  /** Yerel saat ("09:45"); saati olmayan kalemde boş. */
  time: string;
  title: string;
};

export type TodaysPlanWidgetProps = {
  /** Başlık ("Bugünün planı"). */
  heading: string;
  /** Şehir adı; seyahat yoksa boş. */
  city: string;
  /** "Gün 2/5" veya "15 Kas'ta başlıyor"; seyahat yoksa boş. */
  subtitle: string;
  /** Sıradaki 2–3 plan kalemi. */
  items: TodaysPlanWidgetItem[];
  /** Kalem yoksa gösterilecek metin (seyahat yok / bugünlük bitti / plan yok). */
  emptyText: string;
  /** Dokununca açılacak adres. */
  url: string;
};
