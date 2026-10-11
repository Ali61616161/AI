// Gizlilik politikası ve kullanım koşulları. Tek kaynak bu dosyadır: uygulama içi
// "Yasal" ekranı buradan okur, mağazalarda gösterilecek web sayfaları
// `npm run legal:export` ile docs/ klasörüne üretilir.
//
// {{company}}, {{address}}, {{email}}, {{supportEmail}}, {{effectiveDate}} değerleri
// src/config/brand.json → legal bloğundan doldurulur.

export type LegalDoc = { title: string; sections: { heading: string; body: string }[] };
export type LegalLanguage = 'en' | 'tr';

const privacyEn: LegalDoc = {
  title: 'Privacy Policy',
  sections: [
    {
      heading: 'Who we are',
      body: 'Yola is provided by {{company}}, {{address}} ("we"). We are the data controller for the personal data described here. Contact: {{email}}. Effective date: {{effectiveDate}}.',
    },
    {
      heading: 'What we collect',
      body: [
        '• Account: your email address and, if you choose, a display name, birth year, gender and a short bio (needed only for social mode).',
        '• Trips: destinations, dates, travel preferences, plans, expenses, packing lists, ratings and notes you create.',
        '• Documents you upload: tickets and booking confirmations (images or PDFs) and the details read from them.',
        '• Location: only while you use features that need it (places open near you, changing your plan, emergency sharing, social mode). In social mode only an approximate location (about 1 km) is stored.',
        '• Translation: the text, the speech transcript and the photos you choose to translate. Speech is turned into text by your phone’s speech recognition service.',
        '• Purchases: your subscription status and store transaction identifiers (we never see your card details).',
        '• Social mode: invites, messages, blocks and reports.',
        '• Technical data needed to run the service, such as error logs. We do not use advertising identifiers and we do not show ads.',
      ].join('\n'),
    },
    {
      heading: 'How we use it',
      body: 'To provide the app: reading your bookings, planning and replanning your trips, verifying places, showing weather, translating, keeping your trips available offline, processing subscriptions, keeping social mode safe and answering your requests. We use your ratings to tailor future plans. We do not sell your personal data and we do not use it for advertising.',
    },
    {
      heading: 'Legal bases',
      body: 'Performance of our contract with you (providing the app), your consent (location, social mode — you can withdraw it at any time in the app), our legitimate interests (security, preventing abuse, improving the service) and legal obligations (for example tax records for purchases).',
    },
    {
      heading: 'Service providers',
      body: [
        'We share data only with providers that help us run Yola, under contracts that require them to protect it:',
        '• Supabase (database, authentication, file storage, server functions)',
        '• Google (Gemini AI for reading documents, planning and photo translation; Maps Platform for places and weather; Cloud Translation)',
        '• RevenueCat, Apple App Store and Google Play (purchases and subscriptions)',
        '• Your phone’s speech recognition provider (Apple or Google) for conversation translation',
        'Some providers process data outside your country, including in the United States, with appropriate safeguards such as standard contractual clauses.',
      ].join('\n'),
    },
    {
      heading: 'What other travelers see',
      body: 'Only if you turn on social mode: your display name, short bio, interests, what you are up for, verification status and an approximate distance. Your exact location, email and birth year are never shown. You can hide yourself, block or report anyone at any time.',
    },
    {
      heading: 'How long we keep data',
      body: 'As long as your account exists. Offline copies on your phone are removed when you sign out. When you delete your account in Profile → Delete account, your account, trips, documents, messages and other personal data are deleted immediately, except records we must keep by law (such as purchase records kept by the app stores).',
    },
    {
      heading: 'Your rights',
      body: 'You can access, correct, export or delete your data, withdraw consent and object to processing. Most of this can be done in the app; for anything else write to {{email}}. You can also complain to your data protection authority (in Türkiye: KVKK; in the EU: your local supervisory authority).',
    },
    {
      heading: 'Children',
      body: 'Yola is not directed to children under 13. Social mode is only for people aged 18 and over.',
    },
    {
      heading: 'Security',
      body: 'Data is encrypted in transit, access to every record is restricted to its owner by database rules, and uploaded documents are stored in private folders.',
    },
    {
      heading: 'Changes',
      body: 'We will tell you in the app before material changes take effect.',
    },
  ],
};

const termsEn: LegalDoc = {
  title: 'Terms of Use',
  sections: [
    { heading: 'Agreement', body: 'These terms are an agreement between you and {{company}}, {{address}}. By using Yola you accept them. Effective date: {{effectiveDate}}.' },
    {
      heading: 'The service',
      body: 'Yola helps you plan and manage trips using AI. AI suggestions, place details, opening hours, weather, visa information, translations, allergen notes and emergency numbers can be incomplete or wrong. Always check important information (especially visa and entry rules, allergens, safety and bookings) with official or local sources. Yola is not a travel agency and does not sell travel services itself; bookings made through partner links are contracts between you and that partner.',
    },
    { heading: 'Your account', body: 'You must give a valid email address and keep access to your account secure. You are responsible for the content you upload and must have the right to upload it.' },
    {
      heading: 'Social mode',
      body: 'Social mode is only for people aged 18 and over. Meet only in public places, tell someone you trust where you are, and never share sensitive personal or financial information. Harassment, hate, fake profiles, spam, sexual content and any illegal or unsafe behavior are forbidden. We may review reports and suspend or delete accounts that break these rules. Yola does not screen users and is not responsible for the conduct of other users, to the extent permitted by law.',
    },
    {
      heading: 'Subscriptions and purchases',
      body: 'Yola Pro is an auto-renewing subscription (monthly or yearly) that renews unless cancelled at least 24 hours before the end of the current period. Payment is charged to your App Store or Google Play account, and you can manage or cancel in your store account settings. Trip Pass is a one-time purchase for a single trip. Prices are shown in the app before purchase. Refunds are handled by Apple or Google under their policies. Free plan limits may change; we will tell you in the app.',
    },
    { heading: 'Acceptable use', body: 'Do not misuse the service: no reverse engineering, scraping, automated access, attempts to break security or limits, or using Yola to harm others.' },
    { heading: 'Intellectual property', body: 'The app, brand and content provided by us belong to us or our licensors. You keep the rights to your content and give us the permission needed to process it to provide the service.' },
    {
      heading: 'Liability',
      body: 'To the extent permitted by law, the service is provided "as is" and we are not liable for indirect damages or for losses caused by relying on AI suggestions or third-party information. Nothing in these terms limits liability that cannot be limited by law or your rights as a consumer.',
    },
    { heading: 'Ending', body: 'You can delete your account at any time in the app. We may suspend accounts that break these terms.' },
    { heading: 'Law and contact', body: 'These terms are governed by the laws of the country where {{company}} is established, without depriving you of the protection of mandatory consumer laws where you live. Contact: {{supportEmail}}.' },
  ],
};

const privacyTr: LegalDoc = {
  title: 'Gizlilik Politikası',
  sections: [
    {
      heading: 'Biz kimiz',
      body: 'Yola, {{company}} ({{address}}) tarafından sunulur ("biz"). Burada anlatılan kişisel verilerin veri sorumlusu biziz. İletişim: {{email}}. Yürürlük tarihi: {{effectiveDate}}.',
    },
    {
      heading: 'Hangi verileri topluyoruz',
      body: [
        '• Hesap: e-posta adresin ve istersen görünen adın, doğum yılın, cinsiyetin ve kısa tanıtımın (sadece sosyal mod için gerekir).',
        '• Seyahatler: oluşturduğun varış yerleri, tarihler, seyahat tercihleri, planlar, harcamalar, bavul listeleri, puanlar ve notlar.',
        '• Yüklediğin belgeler: biletler ve rezervasyon onayları (görsel veya PDF) ve bunlardan okunan bilgiler.',
        '• Konum: sadece gerektiren özellikleri kullanırken (yakında açık yerler, planı değiştirme, acil durum paylaşımı, sosyal mod). Sosyal modda sadece yaklaşık konum (~1 km) saklanır.',
        '• Çeviri: çevirmek için seçtiğin metin, konuşma dökümü ve fotoğraflar. Konuşma, telefonunun ses tanıma hizmetiyle yazıya çevrilir.',
        '• Satın alımlar: abonelik durumun ve mağaza işlem numaraları (kart bilgilerini asla görmeyiz).',
        '• Sosyal mod: davetler, mesajlar, engellemeler ve şikayetler.',
        '• Hizmeti çalıştırmak için gereken hata kayıtları gibi teknik veriler. Reklam kimliği kullanmayız ve reklam göstermeyiz.',
      ].join('\n'),
    },
    {
      heading: 'Verileri nasıl kullanıyoruz',
      body: 'Uygulamayı sunmak için: rezervasyonlarını okumak, seyahatlerini planlamak ve yeniden planlamak, mekanları doğrulamak, hava durumunu göstermek, çeviri yapmak, seyahatlerini çevrimdışı kullanılabilir tutmak, abonelikleri işlemek, sosyal modu güvenli tutmak ve taleplerini yanıtlamak. Puanlarını sonraki planları kişiselleştirmek için kullanırız. Kişisel verilerini satmayız ve reklam için kullanmayız.',
    },
    {
      heading: 'Hukuki sebepler',
      body: 'Seninle yaptığımız sözleşmenin ifası (uygulamanın sunulması), açık rızan (konum, sosyal mod — istediğin an uygulamadan geri alabilirsin), meşru menfaatimiz (güvenlik, kötüye kullanımın önlenmesi, hizmetin geliştirilmesi) ve hukuki yükümlülükler (ör. satın alımlara ilişkin vergi kayıtları). KVKK m.5 ve m.6 ile GDPR m.6 kapsamında işlenir.',
    },
    {
      heading: 'Hizmet sağlayıcılar ve yurt dışına aktarım',
      body: [
        'Verileri sadece Yola’yı çalıştırmamıza yardım eden ve verileri korumakla sözleşmeyle yükümlü sağlayıcılarla paylaşırız:',
        '• Supabase (veritabanı, kimlik doğrulama, dosya depolama, sunucu fonksiyonları)',
        '• Google (belge okuma, planlama ve fotoğraf çevirisi için Gemini; mekanlar ve hava durumu için Maps Platform; Cloud Translation)',
        '• RevenueCat, Apple App Store ve Google Play (satın alımlar ve abonelikler)',
        '• Konuşma çevirisi için telefonunun ses tanıma sağlayıcısı (Apple veya Google)',
        'Bazı sağlayıcılar verileri ABD dahil yurt dışında işler; aktarım KVKK m.9 ve GDPR kapsamındaki uygun güvencelerle (ör. standart sözleşmeler) yapılır.',
      ].join('\n'),
    },
    {
      heading: 'Diğer gezginler neyi görür',
      body: 'Sadece sosyal modu açarsan: görünen adın, kısa tanıtımın, ilgi alanların, ne için buluşmak istediğin, doğrulama durumun ve yaklaşık mesafe. Tam konumun, e-postan ve doğum yılın asla gösterilmez. İstediğin an kendini gizleyebilir, herkesi engelleyebilir veya şikayet edebilirsin.',
    },
    {
      heading: 'Saklama süresi',
      body: 'Hesabın var olduğu sürece. Telefonundaki çevrimdışı kopyalar çıkış yapınca silinir. Profil → Hesabı sil ile hesabını sildiğinde hesabın, seyahatlerin, belgelerin, mesajların ve diğer kişisel verilerin hemen silinir; kanunen saklanması gereken kayıtlar (ör. mağazaların tuttuğu satın alma kayıtları) hariç.',
    },
    {
      heading: 'Hakların',
      body: 'KVKK m.11 ve GDPR kapsamında verilerine erişme, düzeltme, aktarma ve silme, rızanı geri alma ve işlemeye itiraz etme hakların var. Çoğunu uygulamadan yapabilirsin; diğer talepler için {{email}} adresine yaz. Kişisel Verileri Koruma Kurulu’na (veya AB’de yerel denetim makamına) şikayette bulunabilirsin.',
    },
    { heading: 'Çocuklar', body: 'Yola 13 yaşından küçükler için tasarlanmamıştır. Sosyal mod sadece 18 yaş ve üzeri içindir.' },
    {
      heading: 'Güvenlik',
      body: 'Veriler aktarım sırasında şifrelenir, veritabanı kuralları her kaydı sadece sahibinin erişebileceği şekilde sınırlar ve yüklenen belgeler özel klasörlerde saklanır.',
    },
    { heading: 'Değişiklikler', body: 'Önemli değişiklikler yürürlüğe girmeden önce uygulamada haber veririz.' },
  ],
};

const termsTr: LegalDoc = {
  title: 'Kullanım Koşulları',
  sections: [
    { heading: 'Sözleşme', body: 'Bu koşullar seninle {{company}} ({{address}}) arasında bir sözleşmedir. Yola’yı kullanarak kabul etmiş olursun. Yürürlük tarihi: {{effectiveDate}}.' },
    {
      heading: 'Hizmet',
      body: 'Yola, seyahatlerini AI ile planlamana ve yönetmene yardım eder. AI önerileri, mekan bilgileri, açılış saatleri, hava durumu, vize bilgileri, çeviriler, alerjen notları ve acil numaralar eksik veya hatalı olabilir. Önemli bilgileri (özellikle vize ve giriş kuralları, alerjenler, güvenlik ve rezervasyonlar) her zaman resmi veya yerel kaynaklardan kontrol et. Yola bir seyahat acentesi değildir ve seyahat hizmeti satmaz; iş ortağı bağlantılarıyla yaptığın rezervasyonlar seninle o iş ortağı arasındadır.',
    },
    { heading: 'Hesabın', body: 'Geçerli bir e-posta adresi vermeli ve hesabına erişimi güvende tutmalısın. Yüklediğin içerikten sen sorumlusun ve yükleme hakkına sahip olmalısın.' },
    {
      heading: 'Sosyal mod',
      body: 'Sosyal mod sadece 18 yaş ve üzeri içindir. Sadece halka açık yerlerde buluş, güvendiğin birine nerede olduğunu söyle ve hassas kişisel veya finansal bilgilerini paylaşma. Taciz, nefret söylemi, sahte profil, spam, cinsel içerik ve her türlü yasa dışı veya güvensiz davranış yasaktır. Şikayetleri inceleyebilir, kuralları ihlal eden hesapları askıya alabilir veya silebiliriz. Yola kullanıcıları önceden denetlemez; kanunun izin verdiği ölçüde diğer kullanıcıların davranışlarından sorumlu değildir.',
    },
    {
      heading: 'Abonelikler ve satın alımlar',
      body: 'Yola Pro, mevcut dönemin bitiminden en az 24 saat önce iptal edilmezse otomatik yenilenen aylık veya yıllık bir aboneliktir. Ödeme App Store veya Google Play hesabından alınır; mağaza hesap ayarlarından yönetebilir veya iptal edebilirsin. Trip Pass tek bir seyahat için tek seferlik bir satın almadır. Fiyatlar satın almadan önce uygulamada gösterilir. İadeler Apple veya Google tarafından kendi politikalarına göre yapılır. Ücretsiz plan limitleri değişebilir; uygulamada haber veririz.',
    },
    { heading: 'Kabul edilebilir kullanım', body: 'Hizmeti kötüye kullanma: tersine mühendislik, veri kazıma, otomatik erişim, güvenliği veya limitleri aşmaya çalışma ya da Yola’yı başkalarına zarar vermek için kullanma yasaktır.' },
    { heading: 'Fikri mülkiyet', body: 'Uygulama, marka ve tarafımızca sağlanan içerik bize veya lisans verenlerimize aittir. Kendi içeriğinin hakları sende kalır; hizmeti sunmak için gereken işleme iznini bize verirsin.' },
    {
      heading: 'Sorumluluk',
      body: 'Kanunun izin verdiği ölçüde hizmet "olduğu gibi" sunulur; dolaylı zararlardan ve AI önerilerine veya üçüncü taraf bilgilerine güvenilmesinden doğan kayıplardan sorumlu değiliz. Bu koşullar, kanunen sınırlanamayan sorumluluğu veya tüketici haklarını sınırlamaz.',
    },
    { heading: 'Sona erme', body: 'Hesabını istediğin an uygulamadan silebilirsin. Bu koşulları ihlal eden hesapları askıya alabiliriz.' },
    { heading: 'Uygulanacak hukuk ve iletişim', body: 'Bu koşullara {{company}} şirketinin kurulu olduğu ülkenin hukuku uygulanır; yaşadığın yerin zorunlu tüketici hükümlerinin koruması saklıdır. İletişim: {{supportEmail}}.' },
  ],
};

export const LEGAL: Record<LegalLanguage, { privacy: LegalDoc; terms: LegalDoc }> = {
  en: { privacy: privacyEn, terms: termsEn },
  tr: { privacy: privacyTr, terms: termsTr },
};

export function fillLegal(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, key: string) => values[key] ?? m);
}
