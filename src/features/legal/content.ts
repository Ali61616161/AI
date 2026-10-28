// Gizlilik politikası ve kullanım koşulları. Tek kaynak bu dosyadır: uygulama içi
// "Yasal" ekranı buradan okur, mağazalarda gösterilecek web sayfaları
// `npm run legal:export` ile docs/ klasörüne üretilir.
//
// {{company}}, {{address}}, {{email}}, {{supportEmail}}, {{effectiveDate}} değerleri
// src/config/brand.json → legal bloğundan doldurulur.

export type LegalDoc = { title: string; sections: { heading: string; body: string }[] };
export type LegalLanguage = 'en' | 'tr';
export type LegalDocKey = 'privacy' | 'terms' | 'kvkk';

/** Kayıtta onaylanan sözleşme sürümü. Metinler önemli ölçüde değişince güncellenir. */
export const LEGAL_VERSION = '2026-10-12';

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
        '• Account: your email address and, if you choose, a display name, birth year and a short bio (needed only for social mode).',
        '• Travel profile: your citizenship(s), the visas or residence permits you choose to add and your home city (stored only at city level, about 1 km). We use them to show where you can travel, to filter the destination wheel and for My City suggestions.',
        '• Places: places you save to your lists and places you mark as visited (your city passport).',
        '• Trips: destinations, dates, travel preferences, plans, expenses, packing lists, ratings and notes you create.',
        '• Price watches: the routes, dates and target prices you add.',
        '• Trip journal: the notes, moods and photos you add to your private trip journal. Only you can see them; the photos are stored in a private folder and deleted with your account.',
        '• Documents you upload: tickets and booking confirmations (images or PDFs) and the details read from them.',
        '• Location: only while you use features that need it (places open near you, changing your plan, emergency sharing, social mode). In social mode only an approximate location (about 1 km) is stored.',
        '• Translation: the text, the speech transcript and the photos you choose to translate. Speech is turned into text by your phone’s speech recognition service.',
        '• Purchases: your subscription status and store transaction identifiers (we never see your card details).',
        '• Social mode: invites, messages, blocks and reports.',
        '• Technical data needed to run the service, such as error logs. On the free plan, Google AdMob may process advertising data as described under Advertising.',
      ].join('\n'),
    },
    {
      heading: 'How we use it',
      body: 'To provide the app: reading your bookings, planning and replanning your trips, suggesting evening plans and getaways near your city, estimating trip costs, showing visa requirements for your passport, verifying places, showing weather, translating, keeping your trips available offline, processing subscriptions, keeping social mode safe and answering your requests. We use your ratings to tailor future plans. We do not sell your personal data. With your separate, optional consent we may email you news and offers; you can withdraw it at any time in the app or with the link in every email.',
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
        '• Travelpayouts / Aviasales (flight price data for price watches, and city search: the city name you type is sent to them)',
        '• Airalo, Holafly, Saily (eSIM providers; only if you open their websites from the app)',
        '• RevenueCat, Apple App Store and Google Play (purchases and subscriptions)',
        '• Your phone’s speech recognition provider (Apple or Google) for conversation translation',
        '• Google AdMob (ads, free plan only)',
        '• Booking and ticket partners (such as Booking.com, GetYourGuide, Tiqets and flight or bus ticket sites) only when you tap their link: we pass the destination and dates in the link, never your account details.',
        'Visa and passport information comes from public sources (Passport Index Data, passportindex.org, and official government pages); no personal data is sent to them.',
        'Some providers process data outside your country, including in the United States, with appropriate safeguards such as standard contractual clauses.',
      ].join('\n'),
    },
    {
      heading: 'Advertising',
      body: 'The free plan shows ads from Google AdMob; paid plans have no ads. AdMob may use your device’s advertising identifier, approximate location (from your IP address) and ad interactions to show and measure ads. On iOS we only use the advertising identifier if you allow tracking; in the EU, UK and Switzerland we ask for your consent first and you can change it in the app. Optional rewarded ads give you an extra daily use; for that, Google sends us a signed confirmation with your account ID. We never share your trips, documents or messages with advertisers.',
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
    { heading: 'Your account', body: 'You must be at least 13 years old, give a valid email address and keep access to your account secure. You are responsible for the content you upload and must have the right to upload it.' },
    {
      heading: 'Visa, passport and cost information',
      body: 'Passport power, visa-free destinations and the effect of visas or residence permits you hold are based on public data sources and official pages that can change without notice or be outdated. Cost estimates for getaways and destinations are approximate and are not offers; real prices are set by the partner where you book. Destination wheel and plan suggestions are ideas, not recommendations of safety. Always check entry rules, travel advisories and prices with official sources before you travel.',
    },
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
        '• Hesap: e-posta adresin ve istersen görünen adın, doğum yılın ve kısa tanıtımın (sadece sosyal mod için gerekir).',
        '• Seyahat profili: vatandaşlık(lar)ın, eklemeyi seçtiğin vize ve oturum izinlerin ve yaşadığın şehir (sadece şehir düzeyinde, ~1 km). Nereye gidebileceğini göstermek, ülke çarkını filtrelemek ve Şehrim önerileri için kullanılır.',
        '• Yerler: listelerine kaydettiğin ve gittim olarak işaretlediğin yerler (şehir pasaportun).',
        '• Seyahatler: oluşturduğun varış yerleri, tarihler, seyahat tercihleri, planlar, harcamalar, bavul listeleri, puanlar ve notlar.',
        '• Fiyat takibi: eklediğin rotalar, tarihler ve hedef fiyatlar.',
        '• Seyahat günlüğü: özel günlüğüne eklediğin notlar, ruh halleri ve fotoğraflar. Yalnızca sen görürsün; fotoğraflar özel bir klasörde saklanır ve hesabınla birlikte silinir.',
        '• Yüklediğin belgeler: biletler ve rezervasyon onayları (görsel veya PDF) ve bunlardan okunan bilgiler.',
        '• Konum: sadece gerektiren özellikleri kullanırken (yakında açık yerler, planı değiştirme, acil durum paylaşımı, sosyal mod). Sosyal modda sadece yaklaşık konum (~1 km) saklanır.',
        '• Çeviri: çevirmek için seçtiğin metin, konuşma dökümü ve fotoğraflar. Konuşma, telefonunun ses tanıma hizmetiyle yazıya çevrilir.',
        '• Satın alımlar: abonelik durumun ve mağaza işlem numaraları (kart bilgilerini asla görmeyiz).',
        '• Sosyal mod: davetler, mesajlar, engellemeler ve şikayetler.',
        '• Hizmeti çalıştırmak için gereken hata kayıtları gibi teknik veriler. Ücretsiz planda Google AdMob, Reklamlar bölümünde anlatıldığı gibi reklam verilerini işleyebilir.',
      ].join('\n'),
    },
    {
      heading: 'Verileri nasıl kullanıyoruz',
      body: 'Uygulamayı sunmak için: rezervasyonlarını okumak, seyahatlerini planlamak ve yeniden planlamak, şehrine yakın akşam planları ve kaçamaklar önermek, seyahat maliyetini tahmin etmek, pasaportuna göre vize durumunu göstermek, mekanları doğrulamak, hava durumunu göstermek, çeviri yapmak, seyahatlerini çevrimdışı kullanılabilir tutmak, abonelikleri işlemek, sosyal modu güvenli tutmak ve taleplerini yanıtlamak. Puanlarını sonraki planları kişiselleştirmek için kullanırız. Kişisel verilerini satmayız. Ayrıca vereceğin isteğe bağlı onayla sana kampanya ve yenilikleri e-postayla gönderebiliriz; bu onayı istediğin an uygulamadan veya her e-postadaki bağlantıdan geri alabilirsin.',
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
        '• Travelpayouts / Aviasales (fiyat takibi için uçak bileti fiyat verisi ve şehir arama: yazdığın şehir adı onlara gönderilir)',
        '• Airalo, Holafly, Saily (eSIM sağlayıcıları; yalnızca uygulamadan sitelerini açarsan)',
        '• RevenueCat, Apple App Store ve Google Play (satın alımlar ve abonelikler)',
        '• Konuşma çevirisi için telefonunun ses tanıma sağlayıcısı (Apple veya Google)',
        '• Google AdMob (reklamlar, sadece ücretsiz planda)',
        '• Rezervasyon ve bilet iş ortakları (ör. Booking.com, GetYourGuide, Tiqets, uçak ve otobüs bileti siteleri), sadece bağlantılarına dokunduğunda: bağlantıda varış yeri ve tarihler gider, hesap bilgilerin asla gitmez.',
        'Vize ve pasaport bilgileri herkese açık kaynaklardan (Passport Index Data, passportindex.org ve resmi devlet sayfaları) gelir; bu kaynaklara kişisel veri gönderilmez.',
        'Bazı sağlayıcılar verileri ABD dahil yurt dışında işler; aktarım KVKK m.9 ve GDPR kapsamındaki uygun güvencelerle (ör. standart sözleşmeler) yapılır.',
      ].join('\n'),
    },
    {
      heading: 'Reklamlar',
      body: 'Ücretsiz planda Google AdMob reklamları gösterilir; ücretli planlarda reklam yoktur. AdMob reklamları göstermek ve ölçmek için cihazının reklam kimliğini, IP adresinden yaklaşık konumu ve reklam etkileşimlerini kullanabilir. iOS’ta reklam kimliğini sadece takibe izin verirsen kullanırız; AB, Birleşik Krallık ve İsviçre’de önce onayını alırız ve uygulamadan değiştirebilirsin. İsteğe bağlı ödüllü reklamlar sana ek bir günlük kullanım hakkı verir; bunun için Google bize hesap kimliğinle imzalı bir onay gönderir. Seyahatlerini, belgelerini ve mesajlarını reklamverenlerle asla paylaşmayız.',
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
    { heading: 'Hesabın', body: 'En az 13 yaşında olmalı, geçerli bir e-posta adresi vermeli ve hesabına erişimi güvende tutmalısın. Yüklediğin içerikten sen sorumlusun ve yükleme hakkına sahip olmalısın.' },
    {
      heading: 'Vize, pasaport ve maliyet bilgileri',
      body: 'Pasaport gücü, vizesiz gidilebilen ülkeler ve sahip olduğun vize veya oturum izinlerinin etkisi, haber verilmeden değişebilen veya güncelliğini yitirebilen herkese açık veri kaynaklarına ve resmi sayfalara dayanır. Kaçamak ve ülke maliyet tahminleri yaklaşıktır, teklif değildir; gerçek fiyatı rezervasyon yaptığın iş ortağı belirler. Ülke çarkı ve plan önerileri fikirdir, güvenlik tavsiyesi değildir. Seyahatten önce giriş kurallarını, seyahat uyarılarını ve fiyatları her zaman resmi kaynaklardan kontrol et.',
    },
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

const kvkkTr: LegalDoc = {
  title: 'KVKK Aydınlatma Metni',
  sections: [
    {
      heading: 'Veri sorumlusu',
      body: '6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") m.10 uyarınca, kişisel verilerin veri sorumlusu sıfatıyla {{company}} ({{address}}) tarafından aşağıda açıklanan şekilde işlenir. İletişim: {{email}}.',
    },
    {
      heading: 'İşlenen kişisel veriler',
      body: [
        '• Kimlik ve iletişim: e-posta adresi, görünen ad, doğum yılı.',
        '• Seyahat profili: vatandaşlık, ek vize ve oturum izni türleri, yaşanan şehir (şehir düzeyinde).',
        '• Müşteri işlem: seyahatler, rezervasyon belgeleri ve bunlardan okunan bilgiler, planlar, harcamalar, kayıtlı ve ziyaret edilen yerler, abonelik durumu.',
        '• Konum: sadece gerektiren özellikleri kullanırken (yakındaki yerler, plan değiştirme, acil durum, sosyal mod).',
        '• Görsel ve işitsel: yüklediğin belge görselleri, çeviri için çektiğin fotoğraflar ve konuşma dökümleri.',
        '• İşlem güvenliği: oturum ve hata kayıtları.',
        '• Pazarlama: sadece açık rızan varsa e-posta ile ticari ileti tercihleri.',
      ].join('\n'),
    },
    {
      heading: 'İşleme amaçları',
      body: 'Uygulamanın sunulması ve sözleşmenin ifası; seyahat planlama, maliyet tahmini, vize ve giriş bilgisi gösterme; abonelik ve ödeme süreçlerinin yürütülmesi; bilgi güvenliği ve kötüye kullanımın önlenmesi; taleplerin yanıtlanması; hukuki yükümlülüklerin yerine getirilmesi ve açık rıza verilmişse pazarlama iletişimi.',
    },
    {
      heading: 'Hukuki sebepler',
      body: 'KVKK m.5/2-c (sözleşmenin kurulması ve ifası), m.5/2-ç (hukuki yükümlülük), m.5/2-f (meşru menfaat: güvenlik ve hizmetin geliştirilmesi) ve m.5/1 (açık rıza: konum tabanlı özellikler, sosyal mod ve ticari elektronik ileti). Açık rızanı istediğin an uygulamadan geri alabilirsin; geri alma geçmişteki işlemleri etkilemez.',
    },
    {
      heading: 'Aktarım',
      body: 'Kişisel veriler; hizmeti çalıştırmak için barındırma ve veritabanı (Supabase), yapay zeka ve harita hizmetleri (Google), abonelik altyapısı (RevenueCat, Apple, Google Play) ve ücretsiz planda reklam hizmeti (Google AdMob) sağlayıcılarına ve yetkili kamu kurumlarına kanunen gerektiğinde aktarılabilir. Bu sağlayıcıların bir kısmı yurt dışındadır (ör. ABD); yurt dışına aktarım KVKK m.9 uyarınca uygun güvencelerle (Kurul’a bildirilen standart sözleşmeler) yapılır.',
    },
    {
      heading: 'Toplama yöntemi',
      body: 'Kişisel veriler mobil uygulama üzerinden elektronik ortamda, senin girdiğin bilgilerden, yüklediğin belgelerden ve izin verdiğin cihaz özelliklerinden (konum, kamera, mikrofon) otomatik veya kısmen otomatik yollarla toplanır.',
    },
    {
      heading: 'Hakların (KVKK m.11)',
      body: 'Kişisel verilerinin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işleme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini, KVKK m.7 şartlarıyla silinmesini veya yok edilmesini ve bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme, münhasıran otomatik sistemlerle analiz sonucu aleyhine bir sonuç çıkmasına itiraz etme ve kanuna aykırı işleme nedeniyle zarara uğrarsan zararın giderilmesini talep etme hakların vardır.',
    },
    {
      heading: 'Başvuru',
      body: 'Taleplerini, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ’e uygun olarak, uygulamada kayıtlı e-posta adresinden {{email}} adresine yazarak iletebilirsin. Talebin en geç 30 gün içinde ücretsiz sonuçlandırılır. Hesabını ve verilerini Profil → Hesabı sil ile hemen silebilirsin.',
    },
  ],
};

const kvkkEn: LegalDoc = {
  title: 'Notice under Turkish law (KVKK)',
  sections: [
    {
      heading: 'Data controller',
      body: 'Under Article 10 of the Turkish Personal Data Protection Law No. 6698 ("KVKK"), {{company}} ({{address}}) processes your personal data as data controller as described here. Contact: {{email}}.',
    },
    {
      heading: 'Data we process',
      body: [
        '• Identity and contact: email address, display name, birth year.',
        '• Travel profile: citizenship, types of extra visas and residence permits, home city (city level).',
        '• Customer transactions: trips, booking documents and the details read from them, plans, expenses, saved and visited places, subscription status.',
        '• Location: only while you use features that need it.',
        '• Images and audio: document images, photos and speech transcripts you choose to translate.',
        '• Security: session and error logs.',
        '• Marketing: email preferences, only with your consent.',
      ].join('\n'),
    },
    {
      heading: 'Purposes and legal bases',
      body: 'Providing the app and performing our contract (KVKK Art. 5/2-c), legal obligations (Art. 5/2-ç), legitimate interests such as security and improving the service (Art. 5/2-f) and your explicit consent for location-based features, social mode and marketing emails (Art. 5/1), which you can withdraw at any time.',
    },
    {
      heading: 'Transfers',
      body: 'Data is shared with the service providers listed in the Privacy Policy and with authorities when required by law. Some providers are abroad (for example in the United States); transfers abroad are made with appropriate safeguards under KVKK Art. 9 (standard contracts notified to the Authority).',
    },
    {
      heading: 'Collection method',
      body: 'Electronically through the mobile app, from the information you enter, the documents you upload and the device features you allow.',
    },
    {
      heading: 'Your rights and applications',
      body: 'You have the rights listed in KVKK Art. 11, including to learn whether your data is processed, request information, correction, deletion and notification of third parties, object to results of solely automated analysis and claim compensation. Write to {{email}} from the email address registered in the app; requests are answered free of charge within 30 days.',
    },
  ],
};

export const LEGAL: Record<LegalLanguage, Record<LegalDocKey, LegalDoc>> = {
  en: { privacy: privacyEn, terms: termsEn, kvkk: kvkkEn },
  tr: { privacy: privacyTr, terms: termsTr, kvkk: kvkkTr },
};

export function fillLegal(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (m, key: string) => values[key] ?? m);
}
