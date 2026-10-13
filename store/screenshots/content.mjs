// Mağaza ekran görüntüleri için demo içerik (9 dil). make.mjs tarafından kullanılır.
// Burada sadece AI'ın üreteceği türden metinler var (rota, akşam planı, kaçamaklar,
// "Planı Değiştir" cevabı, canlı çeviri konuşması). Arayüz metinleri uygulamanın
// kendi dil dosyalarından gelir. Mekân adları gerçek yerlerdir (Google'da aranabilir).

export const LANGS = ['tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh'];

/** Playwright tarayıcı dili ve mağaza klasör adları. */
export const LOCALES = {
  tr: { browser: 'tr-TR', asc: 'tr', play: 'tr-TR' },
  en: { browser: 'en-US', asc: 'en-US', play: 'en-US' },
  es: { browser: 'es-ES', asc: 'es-ES', play: 'es-ES' },
  fr: { browser: 'fr-FR', asc: 'fr-FR', play: 'fr-FR' },
  de: { browser: 'de-DE', asc: 'de-DE', play: 'de-DE' },
  it: { browser: 'it-IT', asc: 'it', play: 'it-IT' },
  ru: { browser: 'ru-RU', asc: 'ru', play: 'ru-RU' },
  ar: { browser: 'ar-SA', asc: 'ar-SA', play: 'ar' },
  zh: { browser: 'zh-CN', asc: 'zh-Hans', play: 'zh-CN' },
};

// ---------------------------------------------------------------------------
// Roma rotası (bugünkü gün). Saatler Roma saatiyle.
// ---------------------------------------------------------------------------
const ROME_PLACES = [
  { start: '09:00', end: '11:30', kind: 'activity', place: 'Colosseo', lat: 41.8902, lng: 12.4922, cost: 24, rating: 4.7, count: 412000, indoor: false, priority: 5, booking: 'https://www.tiqets.com/' },
  { start: '12:00', end: '13:15', kind: 'meal', place: 'Salumeria Roscioli', lat: 41.8938, lng: 12.473, cost: 35, rating: 4.6, count: 9800, indoor: true, priority: 3 },
  { start: '14:00', end: '15:00', kind: 'activity', place: 'Pantheon', lat: 41.8986, lng: 12.4769, cost: 5, rating: 4.8, count: 228000, indoor: true, priority: 4 },
  { start: '15:30', end: '17:00', kind: 'activity', place: 'Fontana di Trevi', lat: 41.9009, lng: 12.4833, cost: 0, rating: 4.8, count: 445000, indoor: false, priority: 3 },
  { start: '19:30', end: '21:30', kind: 'meal', place: 'Da Enzo al 29', lat: 41.8885, lng: 12.4718, cost: 40, rating: 4.6, count: 11200, indoor: true, priority: 2 },
];

const ITINERARY = {
  tr: {
    trip: 'Roma',
    summary: 'Antik Roma, en iyi carbonara ve Trastevere akşamları: yürüyerek, kalabalıktan önce.',
    day: 'Antik Roma ve tarihi merkez',
    items: [
      ['Kolezyum ve Roma Forumu', 'Sırasız giriş; kalabalıktan önce erken başla.'],
      ["Roscioli'de carbonara öğle yemeği", 'Şehrin en sevilen carbonarası; rezervasyon önerilir.'],
      ['Pantheon', 'Kubbedeki açıklıktan süzülen ışık için öğleden sonra ideal.'],
      ['Aşk Çeşmesi ve İspanyol Merdivenleri', 'Bozuk para at, sonra Via Condotti boyunca yürü.'],
      ["Trastevere'de akşam yemeği", 'Sarmaşıklı sokaklarda samimi bir trattoria.'],
    ],
  },
  en: {
    trip: 'Rome',
    summary: 'Ancient Rome, the best carbonara and Trastevere evenings — on foot, ahead of the crowds.',
    day: 'Ancient Rome & the old town',
    items: [
      ['Colosseum & Roman Forum', 'Skip-the-line entry; start early before the crowds.'],
      ['Carbonara lunch at Roscioli', "The city's favourite carbonara — booking recommended."],
      ['Pantheon', 'Best in the afternoon light through the oculus.'],
      ['Trevi Fountain & Spanish Steps', 'Toss a coin, then stroll down Via Condotti.'],
      ['Dinner in Trastevere', 'A cosy trattoria on ivy-covered lanes.'],
    ],
  },
  es: {
    trip: 'Roma',
    summary: 'Roma antigua, la mejor carbonara y noches en Trastevere: a pie y antes que las multitudes.',
    day: 'Roma antigua y centro histórico',
    items: [
      ['Coliseo y Foro Romano', 'Entrada sin colas; empieza temprano.'],
      ['Carbonara en Roscioli', 'La carbonara favorita de la ciudad; mejor reservar.'],
      ['Panteón', 'Ideal con la luz de la tarde entrando por el óculo.'],
      ['Fontana di Trevi y Plaza de España', 'Lanza una moneda y pasea por Via Condotti.'],
      ['Cena en Trastevere', 'Una trattoria acogedora entre calles con hiedra.'],
    ],
  },
  fr: {
    trip: 'Rome',
    summary: 'La Rome antique, la meilleure carbonara et les soirées du Trastevere — à pied, avant la foule.',
    day: 'Rome antique et centre historique',
    items: [
      ['Colisée et Forum romain', 'Entrée coupe-file ; commence tôt avant la foule.'],
      ['Carbonara chez Roscioli', 'La carbonara préférée des Romains — réservation conseillée.'],
      ['Panthéon', "Idéal l'après-midi, quand la lumière traverse l'oculus."],
      ['Fontaine de Trevi et place d’Espagne', 'Lance une pièce, puis flâne via Condotti.'],
      ['Dîner au Trastevere', 'Une trattoria chaleureuse dans les ruelles fleuries.'],
    ],
  },
  de: {
    trip: 'Rom',
    summary: 'Antikes Rom, die beste Carbonara und Abende in Trastevere – zu Fuß und vor den Massen.',
    day: 'Antikes Rom & Altstadt',
    items: [
      ['Kolosseum & Forum Romanum', 'Ohne Anstehen; früh starten, bevor es voll wird.'],
      ['Carbonara im Roscioli', 'Die Lieblings-Carbonara der Stadt – besser reservieren.'],
      ['Pantheon', 'Am schönsten im Nachmittagslicht durch das Opaion.'],
      ['Trevi-Brunnen & Spanische Treppe', 'Münze werfen, dann über die Via Condotti bummeln.'],
      ['Abendessen in Trastevere', 'Gemütliche Trattoria in efeuberankten Gassen.'],
    ],
  },
  it: {
    trip: 'Roma',
    summary: 'Roma antica, la carbonara migliore e le serate a Trastevere: a piedi, prima della folla.',
    day: 'Roma antica e centro storico',
    items: [
      ['Colosseo e Foro Romano', 'Ingresso salta-fila; parti presto prima della folla.'],
      ['Carbonara da Roscioli', 'La carbonara più amata della città: meglio prenotare.'],
      ['Pantheon', "Perfetto nel pomeriggio, con la luce che entra dall'oculo."],
      ['Fontana di Trevi e Piazza di Spagna', 'Lancia una moneta e passeggia in via Condotti.'],
      ['Cena a Trastevere', "Una trattoria accogliente tra i vicoli d'edera."],
    ],
  },
  ru: {
    trip: 'Рим',
    summary: 'Древний Рим, лучшая карбонара и вечера в Трастевере — пешком и раньше толп.',
    day: 'Древний Рим и исторический центр',
    items: [
      ['Колизей и Римский форум', 'Вход без очереди; начните пораньше.'],
      ['Карбонара в Roscioli', 'Любимая карбонара римлян — лучше забронировать.'],
      ['Пантеон', 'Лучше всего днём, когда свет падает через окулус.'],
      ['Фонтан Треви и Испанская лестница', 'Бросьте монетку и прогуляйтесь по Via Condotti.'],
      ['Ужин в Трастевере', 'Уютная траттория на увитых плющом улочках.'],
    ],
  },
  ar: {
    trip: 'روما',
    summary: 'روما القديمة وأفضل كاربونارا وأمسيات تراستيفيري، سيرًا على الأقدام وقبل الزحام.',
    day: 'روما القديمة والمركز التاريخي',
    items: [
      ['الكولوسيوم والمنتدى الروماني', 'دخول دون طابور؛ ابدأ مبكرًا قبل الزحام.'],
      ['غداء كاربونارا في روشولي', 'الكاربونارا المفضلة في المدينة، يُنصح بالحجز.'],
      ['البانثيون', 'الأجمل بعد الظهر مع الضوء المتسلل من القبة.'],
      ['نافورة تريفي والدرج الإسباني', 'ارمِ عملة ثم تمشَّ في شارع كوندوتي.'],
      ['عشاء في تراستيفيري', 'مطعم إيطالي دافئ في أزقة تكسوها اللبلاب.'],
    ],
  },
  zh: {
    trip: '罗马',
    summary: '古罗马、最地道的培根蛋酱面和特拉斯提弗列之夜——步行游览，避开人潮。',
    day: '古罗马与历史中心',
    items: [
      ['罗马斗兽场与古罗马广场', '免排队入场，早点出发避开人群。'],
      ['Roscioli 午餐：培根蛋酱面', '罗马人最爱的培根蛋酱面，建议预订。'],
      ['万神殿', '午后阳光从穹顶圆孔洒下时最美。'],
      ['特雷维喷泉与西班牙台阶', '投一枚硬币，再沿康多提大道散步。'],
      ['特拉斯提弗列晚餐', '爬满常春藤的小巷里一家温馨小馆。'],
    ],
  },
};

export function itinerary(lang) {
  const t = ITINERARY[lang];
  return { trip: t.trip, summary: t.summary, day: t.day, items: ROME_PLACES.map((p, i) => ({ ...p, title: t.items[i][0], description: t.items[i][1] })) };
}

// ---------------------------------------------------------------------------
// Şehrim: İstanbul'da bu akşam (TRY)
// ---------------------------------------------------------------------------
const EVENING_STOPS = [
  { time: '19:30', duration_min: 90, kind: 'meal', place_name: 'Karaköy Lokantası', neighborhood: 'Karaköy', est_cost: 1400, rating: 4.6, rating_count: 8600, lat: 41.0237, lng: 28.9776, google_place_id: 'demo-karakoy-lokantasi' },
  { time: '21:15', duration_min: 40, kind: 'walk', place_name: 'Galata Kulesi', neighborhood: 'Beyoğlu', est_cost: 0, rating: 4.7, rating_count: 152000, lat: 41.0256, lng: 28.9741, google_place_id: 'demo-galata' },
  { time: '22:00', duration_min: 75, kind: 'drink', place_name: 'Mikla', neighborhood: 'Beyoğlu', est_cost: 950, rating: 4.6, rating_count: 5400, lat: 41.0319, lng: 28.9767, google_place_id: 'demo-mikla' },
];

const EVENING = {
  tr: { city: 'İstanbul', title: 'İkimize Karaköy akşamı', summary: 'Boğaz lezzetleri, gün batımında bir yürüyüş ve manzaralı bir final.', weather: 'Açık', stops: [['Mezeli akşam yemeği', 'Esnaf lokantası ruhu, modern dokunuş; zeytinyağlıları kaçırma.'], ['Galata’ya gün batımı yürüyüşü', 'Arnavut kaldırımlı yokuşlar ve Haliç’e bakan sokaklar.'], ['Manzaralı kokteyller', 'Teras masası iste: tarihi yarımada ayaklarının altında.']] },
  en: { city: 'Istanbul', title: 'A Karaköy evening for two', summary: 'Bosphorus flavours, a golden-hour walk and a rooftop finale.', weather: 'Clear', stops: [['Meze dinner', 'Classic Istanbul home cooking with a modern twist — try the olive-oil dishes.'], ['Sunset walk to Galata', 'Cobbled lanes with views over the Golden Horn.'], ['Cocktails with a view', 'Ask for the terrace: the old city at your feet.']] },
  es: { city: 'Estambul', title: 'Una noche en Karaköy para dos', summary: 'Sabores del Bósforo, un paseo al atardecer y un final en la azotea.', weather: 'Despejado', stops: [['Cena de mezes', 'Cocina casera de Estambul con un toque moderno.'], ['Paseo al atardecer hasta Gálata', 'Callejuelas empedradas con vistas al Cuerno de Oro.'], ['Cócteles con vistas', 'Pide la terraza: la ciudad antigua a tus pies.']] },
  fr: { city: 'Istanbul', title: 'Une soirée à Karaköy à deux', summary: 'Saveurs du Bosphore, balade au coucher du soleil et final sur un rooftop.', weather: 'Dégagé', stops: [['Dîner de mezzés', 'Cuisine stambouliote traditionnelle, revisitée.'], ['Balade jusqu’à Galata', 'Ruelles pavées avec vue sur la Corne d’Or.'], ['Cocktails avec vue', 'Demande la terrasse : la vieille ville à tes pieds.']] },
  de: { city: 'Istanbul', title: 'Ein Abend in Karaköy zu zweit', summary: 'Bosporus-Küche, ein Spaziergang zur goldenen Stunde und ein Rooftop-Finale.', weather: 'Klar', stops: [['Meze-Abendessen', 'Klassische Istanbuler Küche, modern interpretiert.'], ['Sonnenuntergang am Galataturm', 'Kopfsteingassen mit Blick aufs Goldene Horn.'], ['Cocktails mit Aussicht', 'Frag nach der Terrasse: die Altstadt zu deinen Füßen.']] },
  it: { city: 'Istanbul', title: 'Una serata a Karaköy in due', summary: 'Sapori del Bosforo, una passeggiata al tramonto e un finale in terrazza.', weather: 'Sereno', stops: [['Cena a base di meze', 'Cucina tradizionale di Istanbul in chiave moderna.'], ['Passeggiata al tramonto fino a Galata', 'Vicoli acciottolati con vista sul Corno d’Oro.'], ['Cocktail con vista', 'Chiedi la terrazza: la città vecchia ai tuoi piedi.']] },
  ru: { city: 'Стамбул', title: 'Вечер в Каракёе для двоих', summary: 'Вкусы Босфора, прогулка на закате и финал на крыше.', weather: 'Ясно', stops: [['Ужин с мезе', 'Классическая стамбульская кухня в современной подаче.'], ['Закат у Галатской башни', 'Мощёные улочки с видом на Золотой Рог.'], ['Коктейли с видом', 'Попросите столик на террасе — старый город как на ладони.']] },
  ar: { city: 'إسطنبول', title: 'أمسية في كاراكوي لشخصين', summary: 'نكهات البوسفور، نزهة عند الغروب وختام على السطح.', weather: 'صافٍ', stops: [['عشاء مقبلات تركية', 'مطبخ إسطنبول التقليدي بلمسة عصرية.'], ['نزهة الغروب إلى غلطة', 'أزقة مرصوفة تطل على القرن الذهبي.'], ['مشروبات بإطلالة', 'اطلب طاولة على الشرفة: المدينة القديمة تحت قدميك.']] },
  zh: { city: '伊斯坦布尔', title: '卡拉柯伊的双人夜晚', summary: '博斯普鲁斯风味、黄昏漫步，再去屋顶看夜景。', weather: '晴', stops: [['土耳其开胃菜晚餐', '传统伊斯坦布尔家常菜，现代做法。'], ['日落时分漫步加拉塔塔', '石板小巷，俯瞰金角湾。'], ['景观鸡尾酒', '要一张露台座位，老城尽收眼底。']] },
};

export function eveningPlan(lang) {
  const e = EVENING[lang];
  return {
    city: e.city,
    currency: 'TRY',
    title: e.title,
    summary: e.summary,
    weather: { temperature: 19, description: e.weather, rainChance: 5 },
    when: 'tonight',
    createdAt: new Date().toISOString(),
    stops: EVENING_STOPS.map((s, i) => ({
      ...s,
      title: e.stops[i][0],
      why: e.stops[i][1],
      indoor: s.kind !== 'walk',
      address: null,
      maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.place_name + ' İstanbul')}`,
    })),
  };
}

// ---------------------------------------------------------------------------
// Kaçamaklar: İstanbul'dan 2 günlük (TRY, kişi başı)
// ---------------------------------------------------------------------------
const GETAWAY_BASE = [
  { key: 'bursa', travelMode: 'ferry', travelHours: 2, transportCost: 900, stayPerNight: 1800, dailySpend: 1200, lat: 40.1885, lng: 29.061, distanceKm: 155 },
  { key: 'sapanca', travelMode: 'train', travelHours: 1.5, transportCost: 500, stayPerNight: 2200, dailySpend: 1000, lat: 40.6917, lng: 30.2678, distanceKm: 140 },
  { key: 'edirne', travelMode: 'bus', travelHours: 2.5, transportCost: 800, stayPerNight: 1500, dailySpend: 1100, lat: 41.6771, lng: 26.5557, distanceKm: 235 },
];

const GETAWAYS = {
  tr: { names: ['Bursa', 'Sapanca', 'Edirne'], season: 'İlkbahar ve sonbahar', g: [['Feribotla Marmara’yı geç; tarihi çarşılar, termal hamamlar ve gerçek İskender.', ['Ulu Cami', 'Cumalıkızık', 'İskender']], ['Göl kenarında bungalov, orman yürüyüşleri ve Maşukiye’de kahvaltı.', ['Sapanca Gölü', 'Maşukiye', 'Kartepe']], ['Mimar Sinan’ın şaheseri, tava ciğer ve Meriç kıyısında gün batımı.', ['Selimiye Camii', 'Tava ciğer', 'Meriç Köprüsü']]] },
  en: { names: ['Bursa', 'Sapanca', 'Edirne'], season: 'Spring and autumn', g: [['Ferry across the Marmara: old bazaars, thermal baths and the original İskender kebab.', ['Grand Mosque', 'Cumalıkızık', 'İskender']], ['Lakeside cabins, forest walks and a village breakfast in Maşukiye.', ['Lake Sapanca', 'Maşukiye', 'Kartepe']], ['Sinan’s masterpiece mosque, crispy liver and sunset on the Meriç river.', ['Selimiye Mosque', 'Fried liver', 'Meriç Bridge']]] },
  es: { names: ['Bursa', 'Sapanca', 'Edirne'], season: 'Primavera y otoño', g: [['Ferri por el Mármara: bazares, baños termales y el auténtico kebab İskender.', ['Gran Mezquita', 'Cumalıkızık', 'İskender']], ['Cabañas junto al lago, paseos por el bosque y desayuno en Maşukiye.', ['Lago Sapanca', 'Maşukiye', 'Kartepe']], ['La obra maestra de Sinan e hígado frito junto al río Meriç.', ['Mezquita Selimiye', 'Hígado frito', 'Puente del Meriç']]] },
  fr: { names: ['Bursa', 'Sapanca', 'Edirne'], season: 'Printemps et automne', g: [['Ferry sur la Marmara : bazars, bains thermaux et le vrai kebab İskender.', ['Grande Mosquée', 'Cumalıkızık', 'İskender']], ['Chalets au bord du lac, balades en forêt et petit-déj à Maşukiye.', ['Lac de Sapanca', 'Maşukiye', 'Kartepe']], ['Le chef-d’œuvre de Sinan et coucher de soleil sur la Meriç.', ['Mosquée Selimiye', 'Foie frit', 'Pont de la Meriç']]] },
  de: { names: ['Bursa', 'Sapanca', 'Edirne'], season: 'Frühling und Herbst', g: [['Mit der Fähre übers Marmarameer: Basare, Thermalbäder und echter İskender-Kebab.', ['Große Moschee', 'Cumalıkızık', 'İskender']], ['Hütten am See, Waldspaziergänge und Dorffrühstück in Maşukiye.', ['Sapanca-See', 'Maşukiye', 'Kartepe']], ['Sinans Meisterwerk und Sonnenuntergang am Fluss Meriç.', ['Selimiye-Moschee', 'Gebratene Leber', 'Meriç-Brücke']]] },
  it: { names: ['Bursa', 'Sapanca', 'Edirne'], season: 'Primavera e autunno', g: [['Traghetto sul Mar di Marmara: bazar, terme e il vero kebab İskender.', ['Grande Moschea', 'Cumalıkızık', 'İskender']], ['Bungalow sul lago, passeggiate nel bosco e colazione a Maşukiye.', ['Lago di Sapanca', 'Maşukiye', 'Kartepe']], ['Il capolavoro di Sinan e tramonto sul fiume Meriç.', ['Moschea Selimiye', 'Fegato fritto', 'Ponte sul Meriç']]] },
  ru: { names: ['Бурса', 'Сапанджа', 'Эдирне'], season: 'Весна и осень', g: [['Паром через Мраморное море: базары, термальные бани и настоящий искендер-кебаб.', ['Улу-джами', 'Джумалыкызык', 'Искендер']], ['Домики у озера, лесные прогулки и деревенский завтрак в Машукие.', ['Озеро Сапанджа', 'Машукие', 'Картепе']], ['Шедевр Синана и закат на реке Марица.', ['Мечеть Селимие', 'Жареная печень', 'Мост через Марицу']]] },
  ar: { names: ['بورصة', 'سبانجا', 'أدرنة'], season: 'الربيع والخريف', g: [['عبّارة عبر بحر مرمرة: أسواق قديمة وحمامات حرارية وكباب إسكندر الأصلي.', ['الجامع الكبير', 'جوماليكيزيك', 'إسكندر']], ['أكواخ على البحيرة ونزهات في الغابة وفطور قروي في ماشوكيه.', ['بحيرة سبانجا', 'ماشوكيه', 'كارتبه']], ['تحفة المعماري سنان وغروب على نهر ميريتش.', ['جامع السليمية', 'كبد مقلي', 'جسر ميريتش']]] },
  zh: { names: ['布尔萨', '萨潘贾', '埃迪尔内'], season: '春季和秋季', g: [['乘渡轮穿越马尔马拉海：老巴扎、温泉浴场和正宗伊斯肯德烤肉。', ['大清真寺', '朱马勒克泽克', '伊斯肯德烤肉']], ['湖畔小屋、森林漫步，在马舒基耶吃村庄早餐。', ['萨潘贾湖', '马舒基耶', '卡尔泰佩']], ['建筑大师锡南的杰作，马里查河畔看日落。', ['塞利米耶清真寺', '炸肝', '马里查河大桥']]] },
};

export function getaways(lang) {
  const g = GETAWAYS[lang];
  const days = 2;
  return {
    city: EVENING[lang].city,
    currency: 'TRY',
    days,
    budget_per_person: 6000,
    createdAt: new Date().toISOString(),
    getaways: GETAWAY_BASE.map((b, i) => ({
      city: g.names[i],
      countryCode: 'TR',
      travelMode: b.travelMode,
      travelHours: b.travelHours,
      transportCost: b.transportCost,
      stayPerNight: b.stayPerNight,
      dailySpend: b.dailySpend,
      total: b.transportCost + b.stayPerNight * (days - 1) + b.dailySpend * days,
      highlights: g.g[i][1],
      why: g.g[i][0],
      bestSeason: g.season,
      lat: b.lat,
      lng: b.lng,
      distanceKm: b.distanceKm,
      directionsUrl: `https://www.google.com/maps/dir/?api=1&origin=Istanbul&destination=${encodeURIComponent(GETAWAYS.en.names[i])}`,
    })),
  };
}

// ---------------------------------------------------------------------------
// "Planı Değiştir": yağmur başladı cevabı
// ---------------------------------------------------------------------------
const REPLAN = {
  tr: { reply: 'Yağmur akşama kadar sürecek. Açık hava duraklarını 1 km içindeki kapalı mekânlarla değiştirdim; akşam yemeğin aynı kaldı.', s: [['Kapitol Müzeleri', 'Marcus Aurelius heykeli ve Forum’a kapalı bir manzara.'], ["Sant'Eustachio'da kahve molası", 'Efsane espresso, Pantheon’a 3 dakika.']] },
  en: { reply: "The rain will last until evening. I swapped your outdoor stops for indoor places within 1 km — your dinner stays the same.", s: [['Capitoline Museums', 'Marcus Aurelius and a covered view over the Forum.'], ["Coffee at Sant'Eustachio", 'Legendary espresso, 3 minutes from the Pantheon.']] },
  es: { reply: 'La lluvia durará hasta la noche. He cambiado las paradas al aire libre por lugares cubiertos a menos de 1 km; la cena sigue igual.', s: [['Museos Capitolinos', 'Marco Aurelio y una vista cubierta del Foro.'], ["Café en Sant'Eustachio", 'Un espresso legendario a 3 minutos del Panteón.']] },
  fr: { reply: 'La pluie va durer jusqu’au soir. J’ai remplacé les étapes en plein air par des lieux couverts à moins de 1 km ; ton dîner ne change pas.', s: [['Musées du Capitole', 'Marc Aurèle et une vue abritée sur le Forum.'], ["Café chez Sant'Eustachio", 'Un espresso légendaire à 3 minutes du Panthéon.']] },
  de: { reply: 'Der Regen hält bis zum Abend an. Ich habe die Outdoor-Stopps durch überdachte Orte im Umkreis von 1 km ersetzt – dein Abendessen bleibt.', s: [['Kapitolinische Museen', 'Mark Aurel und ein überdachter Blick aufs Forum.'], ["Kaffee im Sant'Eustachio", 'Legendärer Espresso, 3 Minuten vom Pantheon.']] },
  it: { reply: 'La pioggia durerà fino a sera. Ho sostituito le tappe all’aperto con posti al chiuso entro 1 km; la cena resta invariata.', s: [['Musei Capitolini', 'Marco Aurelio e una vista al coperto sul Foro.'], ["Caffè da Sant'Eustachio", 'Un espresso leggendario a 3 minuti dal Pantheon.']] },
  ru: { reply: 'Дождь продлится до вечера. Я заменил прогулки на крытые места в радиусе 1 км — ужин остаётся в силе.', s: [['Капитолийские музеи', 'Марк Аврелий и вид на Форум под крышей.'], ["Кофе в Sant'Eustachio", 'Легендарный эспрессо в 3 минутах от Пантеона.']] },
  ar: { reply: 'سيستمر المطر حتى المساء. استبدلت المحطات المكشوفة بأماكن مغطاة ضمن 1 كم، ويبقى عشاؤك كما هو.', s: [['متاحف كابيتولين', 'تمثال ماركوس أوريليوس وإطلالة مغطاة على المنتدى.'], ['استراحة قهوة في سانت أوستاكيو', 'إسبريسو أسطوري على بعد 3 دقائق من البانثيون.']] },
  zh: { reply: '雨会一直下到傍晚。我把户外行程换成了 1 公里内的室内地点，晚餐保持不变。', s: [['卡比托利欧博物馆', '马可·奥勒留雕像，还能在室内俯瞰古罗马广场。'], ["Sant'Eustachio 咖啡时光", '传奇浓缩咖啡，距万神殿 3 分钟。']] },
};

export function replanResult(lang, today) {
  const r = REPLAN[lang];
  const base = [
    { start_time: '15:30', end_time: '17:00', kind: 'activity', place_name: 'Musei Capitolini', priority: 4, is_indoor: true, booking: 'none', estimated_cost: 16, currency: 'EUR', rating: 4.7, rating_count: 31500, lat: 41.8933, lng: 12.4828, google_place_id: 'demo-capitolini', booking_url: 'https://www.museicapitolini.org/' },
    { start_time: '17:15', end_time: '17:45', kind: 'free_time', place_name: "Sant'Eustachio Il Caffè", priority: 2, is_indoor: true, booking: 'none', estimated_cost: 3, currency: 'EUR', rating: 4.5, rating_count: 14800, lat: 41.8983, lng: 12.4755, google_place_id: 'demo-eustachio', booking_url: null },
  ];
  return {
    reply: r.reply,
    suggestions: base.map((b, i) => ({ ...b, title: r.s[i][0], description: r.s[i][1], maps_url: null })),
    plan_version_id: '00000000-0000-4000-8000-0000000000aa',
    previous_version_id: '00000000-0000-4000-8000-0000000000ab',
    date: today,
  };
}

// ---------------------------------------------------------------------------
// Canlı çeviri: Roma'da bir garsonla konuşma
// ---------------------------------------------------------------------------
const ASK = {
  tr: 'Terasta iki kişilik masanız var mı?',
  en: 'Do you have a table for two on the terrace?',
  es: '¿Tienen una mesa para dos en la terraza?',
  fr: 'Vous avez une table pour deux en terrasse ?',
  de: 'Haben Sie einen Tisch für zwei auf der Terrasse?',
  it: 'Avete un tavolo per due in terrazza?',
  ru: 'У вас есть столик на двоих на террасе?',
  ar: 'هل لديكم طاولة لشخصين على الشرفة؟',
  zh: '露台上有两人桌吗？',
};
const ANSWER = {
  tr: 'Tabii! On dakika içinde manzaralı bir masa boşalıyor.',
  en: 'Of course! A table with a view frees up in ten minutes.',
  es: '¡Claro! En diez minutos se libera una mesa con vistas.',
  fr: 'Bien sûr ! Une table avec vue se libère dans dix minutes.',
  de: 'Natürlich! In zehn Minuten wird ein Tisch mit Aussicht frei.',
  it: 'Certo! Tra dieci minuti si libera un tavolo con vista.',
  ru: 'Конечно! Через десять минут освободится столик с видом.',
  ar: 'بالتأكيد! ستتوفر طاولة بإطلالة خلال عشر دقائق.',
  zh: '当然！十分钟后会空出一张景观桌。',
};

/** Konuşmanın iki tarafı: kullanıcı kendi dilinde sorar, garson cevap verir. */
export function conversation(lang) {
  const theirs = lang === 'it' ? 'en' : 'it';
  return {
    mine: lang === 'zh' ? 'zh-CN' : lang,
    theirs,
    turns: [
      { side: 'me', said: ASK[lang], translated: ASK[theirs] },
      { side: 'them', said: ANSWER[theirs], translated: ANSWER[lang] },
    ],
  };
}

// ---------------------------------------------------------------------------
// Bilet okuma sonucu (dil bağımsız; tür etiketleri uygulamadan gelir)
// ---------------------------------------------------------------------------
export function parsedTickets(start, end) {
  const ep = (local, tz, place, code, city, cc, address = null) => ({ local_datetime: local, timezone: tz, place_name: place, code, city, country_code: cc, address });
  return {
    flight: {
      document_type: 'flight',
      passenger_names: ['DENIZ YILMAZ'],
      items: [
        { type: 'flight', title: 'Turkish Airlines TK1861', provider_name: 'Turkish Airlines', reference_code: 'X7KQ2M', start: ep(`${start}T08:15`, 'Europe/Istanbul', 'Istanbul Airport', 'IST', 'Istanbul', 'TR'), end: ep(`${start}T10:05`, 'Europe/Rome', 'Rome Fiumicino', 'FCO', 'Rome', 'IT'), details: { flight_number: 'TK1861', seat: '14A' }, confidence: {} },
        { type: 'flight', title: 'Turkish Airlines TK1866', provider_name: 'Turkish Airlines', reference_code: 'X7KQ2M', start: ep(`${end}T17:55`, 'Europe/Rome', 'Rome Fiumicino', 'FCO', 'Rome', 'IT'), end: ep(`${end}T21:40`, 'Europe/Istanbul', 'Istanbul Airport', 'IST', 'Istanbul', 'TR'), details: { flight_number: 'TK1866', seat: '15C' }, confidence: {} },
      ],
    },
    hotel: {
      document_type: 'hotel',
      passenger_names: ['DENIZ YILMAZ'],
      items: [
        { type: 'hotel', title: 'Hotel Artemide', provider_name: 'Booking.com', reference_code: '4183 902 557', start: ep(`${start}T14:00`, 'Europe/Rome', 'Hotel Artemide', null, 'Rome', 'IT', 'Via Nazionale 22, 00184 Roma'), end: ep(`${end}T11:00`, 'Europe/Rome', 'Hotel Artemide', null, 'Rome', 'IT', 'Via Nazionale 22, 00184 Roma'), details: { breakfast_included: true }, confidence: {} },
      ],
    },
  };
}

/** Roma için güneşli hava tahmini açıklaması (Google Weather dile göre döndürür). */
export const SUNNY = { tr: 'Güneşli', en: 'Sunny', es: 'Soleado', fr: 'Ensoleillé', de: 'Sonnig', it: 'Soleggiato', ru: 'Солнечно', ar: 'مشمس', zh: '晴' };
