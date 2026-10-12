#!/usr/bin/env python3
"""Mağaza sayfası metinlerini 9 dilde üretir ve karakter sınırlarını doğrular.
Çıktı: store/app-store/<locale>/*.txt ve store/google-play/<locale>/*.txt
(EAS Metadata / fastlane deliver / supply ile yüklenebilir biçim).
Kullanım: python3 store/build-metadata.py
"""
import os

LIMITS = {"name": 30, "subtitle": 30, "keywords": 100, "promotional_text": 170, "short_description": 80, "description": 4000}

L = {
"en": dict(asc="en-US", play="en-US",
 subtitle="AI trip planner & translator",
 keywords="travel,trip planner,itinerary,ai,translator,visa,passport,schengen,getaway,city guide,offline",
 promo="Upload your tickets and Yola plans every day around them — then replans in a tap when it rains or your train is late.",
 short="AI trip planner: day-by-day plans, live translation, offline mode and more.",
 bullets=["Upload tickets and hotel bookings — AI reads them and builds your trip", "Day-by-day plans for your budget and travel companions", "\"Change the plan\": rain, delays or tiredness? Replan the rest of the day in seconds", "Places verified on Google, open-now spots, weather and hotel ideas", "Live two-way conversation translation, text and menu photos", "Works offline: plan, tickets and emergency phrases on your phone", "Expenses and bill splitting, smart packing list, visa info, jet lag plan", "Trip report with ratings and a shareable card", "Optional social mode: meet travelers in public places, safely"],
 intro="Yola is your AI travel companion. It plans your trip around your real bookings, adapts in the moment and helps you understand and be understood anywhere.",
 plans="Free to start. Yola Pro (monthly or yearly) or a one-time Trip Pass unlocks unlimited planning, replanning and translation."),
"tr": dict(asc="tr", play="tr-TR",
 subtitle="AI seyahat planı ve çeviri",
 keywords="seyahat,gezi planı,rota,yapay zeka,çeviri,vize,pasaport,schengen,kaçamak,tatil,şehir rehberi",
 promo="Biletlerini yükle, Yola her günü onların etrafında planlasın — yağmur yağınca veya tren gecikince tek dokunuşla yeniden planlasın.",
 short="AI seyahat asistanı: gün gün plan, canlı çeviri, çevrimdışı mod ve daha fazlası.",
 bullets=["Bilet ve otel rezervasyonlarını yükle — AI okur ve seyahatini kurar", "Bütçene ve yol arkadaşlarına göre gün gün plan", "\"Planı Değiştir\": yağmur, rötar, yorgunluk mu? Günün kalanını saniyeler içinde yeniden planla", "Google'da doğrulanmış mekanlar, şu an açık yerler, hava durumu ve otel önerileri", "Canlı iki yönlü konuşma çevirisi, metin ve menü fotoğrafı çevirisi", "Çevrimdışı çalışır: plan, biletler ve acil durum cümleleri telefonunda", "Harcama ve hesap bölüşme, akıllı bavul listesi, vize bilgisi, jet lag planı", "Puanlı seyahat raporu ve paylaşılabilir kart", "İsteğe bağlı sosyal mod: gezginlerle güvenle, halka açık yerlerde buluş"],
 intro="Yola, yapay zeka destekli seyahat arkadaşın. Seyahatini gerçek rezervasyonlarının etrafında planlar, anında uyum sağlar ve her yerde anlaşmana yardım eder.",
 plans="Ücretsiz başla. Yola Pro (aylık veya yıllık) ya da tek seferlik Trip Pass ile sınırsız planlama, yeniden planlama ve çeviri."),
"es": dict(asc="es-ES", play="es-ES",
 subtitle="Planificador de viajes con IA",
 keywords="viaje,planificador,itinerario,ia,traductor,visado,pasaporte,schengen,escapada,vacaciones,guía",
 promo="Sube tus billetes y Yola planifica cada día a su alrededor; y si llueve o tu tren se retrasa, replanifica en un toque.",
 short="Planificador de viajes con IA: plan diario, traducción en vivo y modo offline.",
 bullets=["Sube billetes y reservas de hotel: la IA los lee y crea tu viaje", "Planes día a día según tu presupuesto y acompañantes", "\"Cambiar el plan\": ¿lluvia, retrasos o cansancio? Replanifica el resto del día en segundos", "Lugares verificados en Google, abiertos ahora, tiempo e ideas de hotel", "Traducción de conversaciones en vivo, texto y fotos de menús", "Funciona sin conexión: plan, billetes y frases de emergencia en tu móvil", "Gastos y cuentas compartidas, lista de equipaje, visados y plan contra el jet lag", "Informe del viaje con valoraciones y tarjeta para compartir", "Modo social opcional: conoce viajeros en lugares públicos, con seguridad"],
 intro="Yola es tu compañero de viaje con IA. Planifica en torno a tus reservas reales, se adapta al momento y te ayuda a entender y hacerte entender en cualquier lugar.",
 plans="Empieza gratis. Yola Pro (mensual o anual) o un Trip Pass de pago único desbloquean planificación, replanificación y traducción ilimitadas."),
"fr": dict(asc="fr-FR", play="fr-FR",
 subtitle="Planificateur de voyage IA",
 keywords="voyage,itinéraire,planificateur,ia,traducteur,visa,passeport,schengen,escapade,vacances,guide",
 promo="Importez vos billets : Yola planifie chaque jour autour d’eux, et replanifie en un geste s’il pleut ou si votre train a du retard.",
 short="Voyage avec l’IA : plan jour par jour, traduction en direct, mode hors ligne.",
 bullets=["Importez billets et réservations d’hôtel : l’IA les lit et crée votre voyage", "Plans jour par jour selon votre budget et vos compagnons", "« Changer le plan » : pluie, retard ou fatigue ? Replanifiez la fin de journée en quelques secondes", "Lieux vérifiés sur Google, ouverts maintenant, météo et idées d’hôtels", "Traduction de conversation en direct, texte et photos de menus", "Fonctionne hors ligne : plan, billets et phrases d’urgence sur votre téléphone", "Dépenses et partage des frais, liste de valise, visas, plan décalage horaire", "Bilan du voyage avec notes et carte à partager", "Mode social facultatif : rencontrez des voyageurs dans des lieux publics, en sécurité"],
 intro="Yola est votre compagnon de voyage IA. Il planifie autour de vos vraies réservations, s’adapte sur le moment et vous aide à comprendre et à vous faire comprendre partout.",
 plans="Gratuit pour commencer. Yola Pro (mensuel ou annuel) ou un Trip Pass unique débloque planification, replanification et traduction illimitées."),
"de": dict(asc="de-DE", play="de-DE",
 subtitle="KI-Reiseplaner & Übersetzer",
 keywords="reise,reiseplaner,route,ki,übersetzer,visum,reisepass,schengen,kurztrip,urlaub,stadtführer",
 promo="Lade deine Tickets hoch, und Yola plant jeden Tag drumherum – und plant mit einem Tipp neu, wenn es regnet oder der Zug Verspätung hat.",
 short="KI-Reiseplaner: Tagespläne, Live-Übersetzung, Offline-Modus und mehr.",
 bullets=["Tickets und Hotelbuchungen hochladen – die KI liest sie und baut deine Reise", "Tagespläne passend zu Budget und Mitreisenden", "„Plan ändern“: Regen, Verspätung oder müde? Den Rest des Tages in Sekunden neu planen", "Bei Google geprüfte Orte, jetzt geöffnet, Wetter und Hotelideen", "Live-Gesprächsübersetzung, Text und Fotos von Speisekarten", "Funktioniert offline: Plan, Tickets und Notfallsätze auf dem Handy", "Ausgaben und Kostenteilung, smarte Packliste, Visuminfo, Jetlag-Plan", "Reisebericht mit Bewertungen und teilbarer Karte", "Optionaler Social-Modus: Reisende sicher an öffentlichen Orten treffen"],
 intro="Yola ist dein KI-Reisebegleiter. Es plant rund um deine echten Buchungen, passt sich spontan an und hilft dir, überall zu verstehen und verstanden zu werden.",
 plans="Kostenlos starten. Yola Pro (monatlich oder jährlich) oder ein einmaliger Trip Pass schaltet unbegrenztes Planen, Umplanen und Übersetzen frei."),
"it": dict(asc="it", play="it-IT",
 subtitle="Pianificatore di viaggi con IA",
 keywords="viaggio,itinerario,pianificatore,ia,traduttore,visto,passaporto,schengen,gita,vacanze,guida",
 promo="Carica i biglietti e Yola pianifica ogni giorno attorno a loro; se piove o il treno è in ritardo, ripianifica con un tocco.",
 short="Pianificatore di viaggi con IA: piano giornaliero, traduzione live e offline.",
 bullets=["Carica biglietti e prenotazioni: l’IA li legge e crea il tuo viaggio", "Piani giorno per giorno in base a budget e compagni di viaggio", "\"Cambia piano\": pioggia, ritardi o stanchezza? Ripianifica il resto della giornata in pochi secondi", "Luoghi verificati su Google, aperti ora, meteo e idee per l’hotel", "Traduzione live delle conversazioni, testo e foto dei menu", "Funziona offline: piano, biglietti e frasi di emergenza sul telefono", "Spese e conti divisi, valigia intelligente, info visti, piano jet lag", "Resoconto del viaggio con valutazioni e scheda da condividere", "Modalità social facoltativa: incontra viaggiatori in luoghi pubblici, in sicurezza"],
 intro="Yola è il tuo compagno di viaggio con IA. Pianifica attorno alle tue prenotazioni reali, si adatta al momento e ti aiuta a capire e farti capire ovunque.",
 plans="Inizia gratis. Yola Pro (mensile o annuale) o un Trip Pass una tantum sbloccano pianificazione, ripianificazione e traduzione illimitate."),
"ru": dict(asc="ru", play="ru-RU",
 subtitle="ИИ-планировщик поездок",
 keywords="путешествия,маршрут,планировщик,ии,переводчик,виза,паспорт,шенген,поездка,отпуск,гид",
 promo="Загрузите билеты — Yola распланирует каждый день вокруг них и мгновенно перестроит план, если пошёл дождь или задержали поезд.",
 short="ИИ-планировщик поездок: план по дням, живой перевод и офлайн-режим.",
 bullets=["Загрузите билеты и брони отелей — ИИ прочитает их и соберёт поездку", "План по дням с учётом бюджета и попутчиков", "«Изменить план»: дождь, задержка или усталость? Новый план на остаток дня за секунды", "Проверенные в Google места, открытые сейчас заведения, погода и отели", "Живой перевод разговора в обе стороны, текста и фото меню", "Работает офлайн: план, билеты и экстренные фразы в телефоне", "Расходы и деление счёта, умный список вещей, визы, план против джетлага", "Итоги поездки с оценками и карточкой для публикации", "Необязательный социальный режим: безопасные встречи с путешественниками в людных местах"],
 intro="Yola — ваш ИИ-спутник в путешествиях. Он планирует поездку вокруг реальных броней, подстраивается на ходу и помогает понимать и быть понятым где угодно.",
 plans="Начните бесплатно. Yola Pro (месяц или год) или разовый Trip Pass открывают безлимитное планирование, перепланирование и перевод."),
"ar": dict(asc="ar-SA", play="ar",
 subtitle="مخطط رحلات ومترجم بالذكاء",
 keywords="سفر,رحلة,مخطط رحلات,ذكاء اصطناعي,مترجم,تأشيرة,جواز سفر,شنغن,رحلات قريبة,عطلة",
 promo="ارفع تذاكرك ليخطط Yola كل يوم حولها، ويعيد التخطيط بلمسة إذا أمطرت أو تأخر قطارك.",
 short="مخطط رحلات بالذكاء الاصطناعي: خطة يومية وترجمة فورية ووضع دون اتصال.",
 bullets=["ارفع التذاكر وحجوزات الفنادق، ويقرؤها الذكاء الاصطناعي ويبني رحلتك", "خطط يومية حسب ميزانيتك ورفاق سفرك", "«غيّر الخطة»: مطر أو تأخير أو تعب؟ أعد تخطيط بقية اليوم في ثوانٍ", "أماكن موثّقة على Google ومفتوحة الآن، والطقس واقتراحات الفنادق", "ترجمة محادثات فورية في الاتجاهين، وترجمة النصوص وصور قوائم الطعام", "يعمل دون اتصال: الخطة والتذاكر وعبارات الطوارئ على هاتفك", "المصاريف وتقسيم الحساب، وقائمة حقيبة ذكية، ومعلومات التأشيرة، وخطة فرق التوقيت", "تقرير رحلة بالتقييمات وبطاقة للمشاركة", "وضع اجتماعي اختياري: التقِ بالمسافرين بأمان في الأماكن العامة"],
 intro="Yola رفيقك في السفر بالذكاء الاصطناعي. يخطط رحلتك حول حجوزاتك الحقيقية، ويتكيّف في اللحظة، ويساعدك على الفهم والتفاهم في أي مكان.",
 plans="ابدأ مجانًا. يفتح Yola Pro (شهري أو سنوي) أو Trip Pass لمرة واحدة التخطيط وإعادة التخطيط والترجمة بلا حدود."),
"zh": dict(asc="zh-Hans", play="zh-CN",
 subtitle="AI 旅行规划与翻译",
 keywords="旅行,行程规划,攻略,人工智能,翻译,签证,护照,申根,周边游,度假,城市指南,离线",
 promo="上传机票，Yola 围绕它规划每一天；下雨或火车晚点时，一键重新规划。",
 short="AI 旅行规划：每日行程、实时翻译、离线模式等。",
 bullets=["上传机票和酒店预订，AI 自动识别并生成行程", "根据预算和同行人规划每日行程", "「调整计划」：下雨、延误或疲惫？几秒钟重新规划当天剩余行程", "经 Google 验证的地点、正在营业的店铺、天气和酒店推荐", "实时双向对话翻译、文本和菜单照片翻译", "离线可用：行程、票据和紧急用语都在手机上", "记账与分摊、智能行李清单、签证信息、倒时差计划", "带评分的旅行报告和可分享卡片", "可选社交模式：在公共场所安全结识旅伴"],
 intro="Yola 是你的 AI 旅行伙伴。它围绕你的真实预订规划行程，随时调整，并帮助你在任何地方沟通无碍。",
 plans="免费开始。Yola Pro（月付或年付）或一次性 Trip Pass 解锁无限规划、调整和翻译。"),
}
# Seyahat dışı (Şehrim) ve pasaport/geçmiş bölümleri; uygulamadaki özellik adlarıyla aynı.
EXTRA = {
"en": dict(
 city_head="Not traveling? Yola works in your own city too:",
 city=["My City: plans for tonight and the weekend with real, open places near you", "\"Decide for me\": can't choose? Get one great pick, new places only if you like", "My lists and City passport: save places, track what you discovered, earn badges", "Getaways: budget-friendly short trips near you, by distance and budget", "Spin the wheel: let luck pick your next country and share the card"],
 docs_head="Your passport and travel history:",
 docs=["My passport: see where your passport and extra visas (Schengen, US, UK and more) let you go", "Countries I've visited: your share of the world and each continent, countries, cities and badges", "Schengen 90/180 calculator and passport and visa expiry reminders"],
 ads="The free version shows ads; Pro is ad-free."),
"tr": dict(
 city_head="Seyahatte değil misin? Yola kendi şehrinde de çalışır:",
 city=["Şehrim: yakınındaki gerçek ve açık mekanlarla bu akşam ve hafta sonu planı", "\"Kararsızım\": seçemiyor musun? Tek bir güzel öneri al, istersen sadece yeni yerler", "Listelerim ve Şehir pasaportu: mekanları kaydet, keşfettiklerini takip et, rozet kazan", "Kaçamaklar: yakınındaki bütçe dostu kısa tatiller, mesafe ve bütçeye göre", "Çarkı çevir: sıradaki ülkeni şansa bırak, kartını paylaş"],
 docs_head="Pasaportun ve seyahat geçmişin:",
 docs=["Pasaportum: pasaportun ve ek vizelerinle (Schengen, ABD, İngiltere ve daha fazlası) nerelere gidebileceğini gör", "Gezdiğim ülkeler: dünyanın ve her kıtanın yüzde kaçını gezdiğin, ülke ve şehir sayın, rozetlerin", "Schengen 90/180 hesaplayıcı, pasaport ve vize son kullanma hatırlatıcıları"],
 ads="Ücretsiz sürümde reklam gösterilir; Pro reklamsızdır."),
"es": dict(
 city_head="¿No estás de viaje? Yola también funciona en tu ciudad:",
 city=["Mi ciudad: planes para esta noche y el fin de semana con lugares reales y abiertos cerca de ti", "\"Decide por mí\": ¿no te decides? Recibe una sola buena idea, solo sitios nuevos si quieres", "Mis listas y Pasaporte de ciudad: guarda lugares, sigue lo que descubres y gana insignias", "Escapadas: viajes cortos y económicos cerca de ti, por distancia y presupuesto", "Gira la ruleta: deja que la suerte elija tu próximo país y comparte la tarjeta"],
 docs_head="Tu pasaporte y tu historial de viajes:",
 docs=["Mi pasaporte: descubre adónde puedes ir con tu pasaporte y tus visados (Schengen, EE. UU., Reino Unido y más)", "Países que he visitado: qué parte del mundo y de cada continente conoces, países, ciudades e insignias", "Calculadora Schengen 90/180 y recordatorios de caducidad de pasaporte y visados"],
 ads="La versión gratuita muestra anuncios; Pro no tiene anuncios."),
"fr": dict(
 city_head="Pas en voyage ? Yola fonctionne aussi dans votre ville :",
 city=["Ma ville : un plan pour ce soir et le week-end avec de vrais lieux ouverts près de vous", "« Décide pour moi » : vous hésitez ? Une seule bonne idée, uniquement des nouveautés si vous voulez", "Mes listes et Passeport de ville : enregistrez des lieux, suivez vos découvertes, gagnez des badges", "Escapades : courts séjours petit budget près de chez vous, selon distance et budget", "Fais tourner la roue : laissez le hasard choisir votre prochain pays et partagez la carte"],
 docs_head="Votre passeport et votre historique de voyage :",
 docs=["Mon passeport : découvrez où votre passeport et vos visas (Schengen, États-Unis, Royaume-Uni et plus) vous permettent d’aller", "Pays que j’ai visités : votre part du monde et de chaque continent, pays, villes et badges", "Calculateur Schengen 90/180 et rappels d’expiration du passeport et des visas"],
 ads="La version gratuite affiche des publicités ; Pro est sans publicité."),
"de": dict(
 city_head="Nicht auf Reisen? Yola funktioniert auch in deiner Stadt:",
 city=["Meine Stadt: Pläne für heute Abend und das Wochenende mit echten, geöffneten Orten in deiner Nähe", "„Entscheide für mich“: Unentschlossen? Ein guter Vorschlag, auf Wunsch nur neue Orte", "Meine Listen und Stadtpass: Orte speichern, Entdeckungen festhalten, Abzeichen sammeln", "Kurztrips: günstige Ausflüge in deiner Nähe, nach Entfernung und Budget", "Dreh am Rad: Lass den Zufall dein nächstes Land wählen und teile die Karte"],
 docs_head="Dein Pass und deine Reisegeschichte:",
 docs=["Mein Pass: Sieh, wohin dich dein Pass und deine Visa (Schengen, USA, UK und mehr) bringen", "Meine besuchten Länder: dein Anteil an der Welt und jedem Kontinent, Länder, Städte und Abzeichen", "Schengen-Rechner 90/180 und Erinnerungen an ablaufende Pässe und Visa"],
 ads="Die kostenlose Version zeigt Werbung; Pro ist werbefrei."),
"it": dict(
 city_head="Non sei in viaggio? Yola funziona anche nella tua città:",
 city=["La mia città: piani per stasera e il weekend con luoghi reali e aperti vicino a te", "\"Decidi tu\": indeciso? Ricevi una sola buona proposta, solo posti nuovi se vuoi", "Le mie liste e Passaporto cittadino: salva luoghi, segui le tue scoperte, ottieni badge", "Gite: brevi viaggi low cost vicino a te, per distanza e budget", "Gira la ruota: lascia che la fortuna scelga il tuo prossimo paese e condividi la scheda"],
 docs_head="Il tuo passaporto e la tua storia di viaggio:",
 docs=["Il mio passaporto: scopri dove puoi andare con il tuo passaporto e i tuoi visti (Schengen, USA, Regno Unito e altri)", "Paesi che ho visitato: quanta parte del mondo e di ogni continente hai visto, paesi, città e badge", "Calcolatore Schengen 90/180 e promemoria di scadenza di passaporto e visti"],
 ads="La versione gratuita mostra annunci; Pro è senza pubblicità."),
"ru": dict(
 city_head="Не в поездке? Yola работает и в вашем городе:",
 city=["Мой город: план на вечер и выходные с реальными открытыми местами рядом", "«Реши за меня»: не можете выбрать? Одна хорошая идея, при желании только новые места", "Мои списки и Паспорт города: сохраняйте места, отмечайте открытия, получайте значки", "Поездки: недорогие короткие путешествия рядом, по расстоянию и бюджету", "Крути колесо: пусть удача выберет следующую страну, а карточкой можно поделиться"],
 docs_head="Ваш паспорт и история путешествий:",
 docs=["Мой паспорт: куда можно поехать с вашим паспортом и визами (Шенген, США, Великобритания и другие)", "Посещённые страны: какая часть мира и каждого континента пройдена, страны, города и значки", "Шенгенский калькулятор 90/180 и напоминания об окончании срока паспорта и виз"],
 ads="В бесплатной версии показывается реклама; Pro без рекламы."),
"ar": dict(
 city_head="لست مسافرًا؟ يعمل Yola في مدينتك أيضًا:",
 city=["مدينتي: خطة لهذه الليلة وعطلة نهاية الأسبوع بأماكن حقيقية ومفتوحة قريبة منك", "«قرر عني»: محتار؟ احصل على اقتراح واحد جيد، وأماكن جديدة فقط إن أردت", "قوائمي وجواز المدينة: احفظ الأماكن وتابع اكتشافاتك واربح الشارات", "رحلات قريبة: رحلات قصيرة اقتصادية بالقرب منك حسب المسافة والميزانية", "أدر العجلة: دع الحظ يختار بلدك التالي وشارك البطاقة"],
 docs_head="جواز سفرك وسجل رحلاتك:",
 docs=["جواز سفري: اعرف إلى أين يأخذك جوازك وتأشيراتك (شنغن والولايات المتحدة والمملكة المتحدة وغيرها)", "البلدان التي زرتها: نسبة ما زرته من العالم ومن كل قارة، والبلدان والمدن والشارات", "حاسبة شنغن 90/180 وتذكيرات انتهاء صلاحية الجواز والتأشيرات"],
 ads="تعرض النسخة المجانية إعلانات؛ أما Pro فبلا إعلانات."),
"zh": dict(
 city_head="不在旅行？Yola 在你的城市同样好用：",
 city=["我的城市：用附近真实营业的地点安排今晚和周末", "「帮我决定」：选不出来？给你一个好去处，也可以只看没去过的地方", "我的清单和城市护照：收藏地点、记录探索、赢取徽章", "周边小旅行：按距离和预算推荐附近的实惠短途游", "转转盘：让运气选出你的下一个国家，并分享卡片"],
 docs_head="你的护照与旅行足迹：",
 docs=["我的护照：看看你的护照和额外签证（申根、美国、英国等）能去哪里", "我去过的国家：你走过世界和各大洲的百分比、国家和城市数量以及徽章", "申根 90/180 计算器，以及护照和签证到期提醒"],
 ads="免费版含广告；Pro 无广告。"),
}

NAME = "Yola: AI Travel Planner"
root = os.path.dirname(os.path.abspath(__file__))
problems = []
for lang, d in L.items():
    x = EXTRA[lang]
    bullets = lambda items: "\n".join(f"• {b}" for b in items)
    desc = "\n\n".join([
        d["intro"], bullets(d["bullets"]),
        x["city_head"] + "\n" + bullets(x["city"]),
        x["docs_head"] + "\n" + bullets(x["docs"]),
        d["plans"] + " " + x["ads"],
    ])
    files = {
        f"app-store/{d['asc']}/name.txt": NAME,
        f"app-store/{d['asc']}/subtitle.txt": d["subtitle"],
        f"app-store/{d['asc']}/keywords.txt": d["keywords"],
        f"app-store/{d['asc']}/promotional_text.txt": d["promo"],
        f"app-store/{d['asc']}/description.txt": desc,
        f"app-store/{d['asc']}/release_notes.txt": d["intro"].split(".")[0] + ".",
        f"google-play/{d['play']}/title.txt": NAME,
        f"google-play/{d['play']}/short_description.txt": d["short"],
        f"google-play/{d['play']}/full_description.txt": desc,
    }
    checks = {"name": NAME, "subtitle": d["subtitle"], "keywords": d["keywords"], "promotional_text": d["promo"], "short_description": d["short"], "description": desc}
    for k, v in checks.items():
        if len(v) > LIMITS[k]:
            problems.append(f"{lang} {k}: {len(v)} > {LIMITS[k]}")
    for path, text in files.items():
        full = os.path.join(root, path)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w") as f:
            f.write(text + "\n")
if problems:
    raise SystemExit("Karakter sınırı aşıldı:\n" + "\n".join(problems))
print("store metadata: 9 dil, sınırlar uygun")
