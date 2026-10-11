// Acil durum ve temel ihtiyaç cümleleri. Uygulamanın içinde gelir; internet
// olmadan da çalışır. Diller uygulamanın desteklediği 9 dildir.

export const PHRASE_LANGUAGES = ['tr', 'en', 'es', 'fr', 'de', 'it', 'ru', 'ar', 'zh'] as const;
export type PhraseLanguage = (typeof PHRASE_LANGUAGES)[number];

export type Phrase = { key: string; urgent?: boolean; text: Record<PhraseLanguage, string> };

export const PHRASES: Phrase[] = [
  {
    key: 'help',
    urgent: true,
    text: { tr: 'İmdat! Yardım edin!', en: 'Help!', es: '¡Socorro! ¡Ayuda!', fr: 'Au secours !', de: 'Hilfe!', it: 'Aiuto!', ru: 'Помогите!', ar: 'النجدة! ساعدوني!', zh: '救命！' },
  },
  {
    key: 'callPolice',
    urgent: true,
    text: {
      tr: 'Lütfen polisi arayın.',
      en: 'Please call the police.',
      es: 'Por favor, llame a la policía.',
      fr: 'Appelez la police, s’il vous plaît.',
      de: 'Bitte rufen Sie die Polizei.',
      it: 'Per favore, chiami la polizia.',
      ru: 'Пожалуйста, вызовите полицию.',
      ar: 'من فضلك اتصل بالشرطة.',
      zh: '请报警。',
    },
  },
  {
    key: 'callAmbulance',
    urgent: true,
    text: {
      tr: 'Lütfen ambulans çağırın.',
      en: 'Please call an ambulance.',
      es: 'Por favor, llame a una ambulancia.',
      fr: 'Appelez une ambulance, s’il vous plaît.',
      de: 'Bitte rufen Sie einen Krankenwagen.',
      it: 'Per favore, chiami un’ambulanza.',
      ru: 'Пожалуйста, вызовите скорую помощь.',
      ar: 'من فضلك اطلب سيارة إسعاف.',
      zh: '请叫救护车。',
    },
  },
  {
    key: 'hurt',
    urgent: true,
    text: {
      tr: 'Biri yaralandı.',
      en: 'Someone is hurt.',
      es: 'Hay una persona herida.',
      fr: 'Quelqu’un est blessé.',
      de: 'Jemand ist verletzt.',
      it: 'C’è una persona ferita.',
      ru: 'Человек ранен.',
      ar: 'هناك شخص مصاب.',
      zh: '有人受伤了。',
    },
  },
  {
    key: 'fire',
    urgent: true,
    text: { tr: 'Yangın var!', en: 'Fire!', es: '¡Fuego!', fr: 'Au feu !', de: 'Feuer!', it: 'Al fuoco!', ru: 'Пожар!', ar: 'حريق!', zh: '着火了！' },
  },
  {
    key: 'needDoctor',
    urgent: true,
    text: {
      tr: 'Doktora ihtiyacım var.',
      en: 'I need a doctor.',
      es: 'Necesito un médico.',
      fr: 'J’ai besoin d’un médecin.',
      de: 'Ich brauche einen Arzt.',
      it: 'Ho bisogno di un medico.',
      ru: 'Мне нужен врач.',
      ar: 'أحتاج إلى طبيب.',
      zh: '我需要看医生。',
    },
  },
  {
    key: 'hospital',
    text: {
      tr: 'En yakın hastane nerede?',
      en: 'Where is the nearest hospital?',
      es: '¿Dónde está el hospital más cercano?',
      fr: 'Où est l’hôpital le plus proche ?',
      de: 'Wo ist das nächste Krankenhaus?',
      it: 'Dov’è l’ospedale più vicino?',
      ru: 'Где ближайшая больница?',
      ar: 'أين أقرب مستشفى؟',
      zh: '最近的医院在哪里？',
    },
  },
  {
    key: 'pharmacy',
    text: {
      tr: 'Eczane nerede?',
      en: 'Where is a pharmacy?',
      es: '¿Dónde hay una farmacia?',
      fr: 'Où se trouve une pharmacie ?',
      de: 'Wo ist eine Apotheke?',
      it: 'Dov’è una farmacia?',
      ru: 'Где аптека?',
      ar: 'أين توجد صيدلية؟',
      zh: '药店在哪里？',
    },
  },
  {
    key: 'allergy',
    text: {
      tr: 'Alerjim var. Lütfen yemeğin içeriğini söyler misiniz?',
      en: 'I have an allergy. Could you tell me what is in this dish?',
      es: 'Tengo una alergia. ¿Me puede decir qué lleva este plato?',
      fr: 'J’ai une allergie. Pouvez-vous me dire ce que contient ce plat ?',
      de: 'Ich habe eine Allergie. Können Sie mir sagen, was in diesem Gericht ist?',
      it: 'Ho un’allergia. Può dirmi cosa contiene questo piatto?',
      ru: 'У меня аллергия. Скажите, пожалуйста, что входит в это блюдо?',
      ar: 'لدي حساسية. هل يمكنك أن تخبرني بمكونات هذا الطبق؟',
      zh: '我有过敏症。请问这道菜里有什么？',
    },
  },
  {
    key: 'lost',
    text: {
      tr: 'Kayboldum.',
      en: 'I am lost.',
      es: 'Estoy perdido/a.',
      fr: 'Je suis perdu(e).',
      de: 'Ich habe mich verlaufen.',
      it: 'Mi sono perso/a.',
      ru: 'Я заблудился (заблудилась).',
      ar: 'لقد ضللت الطريق.',
      zh: '我迷路了。',
    },
  },
  {
    key: 'lostPassport',
    text: {
      tr: 'Pasaportumu kaybettim.',
      en: 'I lost my passport.',
      es: 'He perdido mi pasaporte.',
      fr: 'J’ai perdu mon passeport.',
      de: 'Ich habe meinen Reisepass verloren.',
      it: 'Ho perso il passaporto.',
      ru: 'Я потерял(а) паспорт.',
      ar: 'لقد فقدت جواز سفري.',
      zh: '我的护照丢了。',
    },
  },
  {
    key: 'stolen',
    text: {
      tr: 'Çantam çalındı.',
      en: 'My bag was stolen.',
      es: 'Me han robado el bolso.',
      fr: 'On m’a volé mon sac.',
      de: 'Meine Tasche wurde gestohlen.',
      it: 'Mi hanno rubato la borsa.',
      ru: 'У меня украли сумку.',
      ar: 'لقد سُرقت حقيبتي.',
      zh: '我的包被偷了。',
    },
  },
  {
    key: 'embassy',
    text: {
      tr: 'Büyükelçiliğimle iletişime geçmem gerekiyor.',
      en: 'I need to contact my embassy.',
      es: 'Necesito contactar con mi embajada.',
      fr: 'Je dois contacter mon ambassade.',
      de: 'Ich muss meine Botschaft kontaktieren.',
      it: 'Devo contattare la mia ambasciata.',
      ru: 'Мне нужно связаться с моим посольством.',
      ar: 'أحتاج إلى التواصل مع سفارة بلدي.',
      zh: '我需要联系我国大使馆。',
    },
  },
  {
    key: 'address',
    text: {
      tr: 'Lütfen beni bu adrese götürün.',
      en: 'Please take me to this address.',
      es: 'Por favor, lléveme a esta dirección.',
      fr: 'Emmenez-moi à cette adresse, s’il vous plaît.',
      de: 'Bitte bringen Sie mich zu dieser Adresse.',
      it: 'Per favore, mi porti a questo indirizzo.',
      ru: 'Пожалуйста, отвезите меня по этому адресу.',
      ar: 'من فضلك خذني إلى هذا العنوان.',
      zh: '请带我去这个地址。',
    },
  },
  {
    key: 'noSpeak',
    text: {
      tr: 'Bu dili konuşmuyorum.',
      en: 'I don’t speak this language.',
      es: 'No hablo este idioma.',
      fr: 'Je ne parle pas cette langue.',
      de: 'Ich spreche diese Sprache nicht.',
      it: 'Non parlo questa lingua.',
      ru: 'Я не говорю на этом языке.',
      ar: 'لا أتحدث هذه اللغة.',
      zh: '我不会说这种语言。',
    },
  },
  {
    key: 'english',
    text: {
      tr: 'İngilizce konuşuyor musunuz?',
      en: 'Do you speak English?',
      es: '¿Habla inglés?',
      fr: 'Parlez-vous anglais ?',
      de: 'Sprechen Sie Englisch?',
      it: 'Parla inglese?',
      ru: 'Вы говорите по-английски?',
      ar: 'هل تتحدث الإنجليزية؟',
      zh: '您会说英语吗？',
    },
  },
  {
    key: 'toilet',
    text: {
      tr: 'Tuvalet nerede?',
      en: 'Where is the toilet?',
      es: '¿Dónde está el baño?',
      fr: 'Où sont les toilettes ?',
      de: 'Wo ist die Toilette?',
      it: 'Dov’è il bagno?',
      ru: 'Где туалет?',
      ar: 'أين الحمام؟',
      zh: '洗手间在哪里？',
    },
  },
  {
    key: 'water',
    text: {
      tr: 'Su alabilir miyim, lütfen?',
      en: 'Could I have some water, please?',
      es: '¿Me da agua, por favor?',
      fr: 'Je peux avoir de l’eau, s’il vous plaît ?',
      de: 'Kann ich bitte Wasser haben?',
      it: 'Posso avere dell’acqua, per favore?',
      ru: 'Можно воды, пожалуйста?',
      ar: 'هل يمكنني الحصول على ماء من فضلك؟',
      zh: '请给我一些水。',
    },
  },
  {
    key: 'howMuch',
    text: {
      tr: 'Bu ne kadar?',
      en: 'How much is this?',
      es: '¿Cuánto cuesta?',
      fr: 'Combien ça coûte ?',
      de: 'Wie viel kostet das?',
      it: 'Quanto costa?',
      ru: 'Сколько это стоит?',
      ar: 'كم سعر هذا؟',
      zh: '这个多少钱？',
    },
  },
  {
    key: 'thanks',
    text: {
      tr: 'Çok teşekkür ederim.',
      en: 'Thank you very much.',
      es: 'Muchas gracias.',
      fr: 'Merci beaucoup.',
      de: 'Vielen Dank.',
      it: 'Grazie mille.',
      ru: 'Большое спасибо.',
      ar: 'شكرًا جزيلًا.',
      zh: '非常感谢。',
    },
  },
];

const COUNTRY_LANGUAGE: Record<string, PhraseLanguage> = {
  TR: 'tr', CY: 'tr',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', UY: 'es', CR: 'es', CU: 'es', DO: 'es', EC: 'es', BO: 'es', PY: 'es', VE: 'es', GT: 'es', PA: 'es',
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr', SN: 'fr', CI: 'fr', TN: 'fr',
  DE: 'de', AT: 'de', CH: 'de', LI: 'de',
  IT: 'it', SM: 'it', VA: 'it',
  RU: 'ru', BY: 'ru', KZ: 'ru', KG: 'ru',
  SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar', JO: 'ar', QA: 'ar', KW: 'ar', BH: 'ar', OM: 'ar', LB: 'ar', IQ: 'ar', DZ: 'ar',
  CN: 'zh', TW: 'zh', HK: 'zh', MO: 'zh', SG: 'zh',
};

/** Ülkenin dili cümle kitabında yoksa İngilizce kullanılır. */
export function phraseLanguageForCountry(countryCode: string | null | undefined): PhraseLanguage {
  return (countryCode && COUNTRY_LANGUAGE[countryCode.toUpperCase()]) || 'en';
}

/** expo-speech için BCP-47 ses dili. */
export const SPEECH_LOCALE: Record<PhraseLanguage, string> = {
  tr: 'tr-TR', en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', it: 'it-IT', ru: 'ru-RU', ar: 'ar-SA', zh: 'zh-CN',
};
