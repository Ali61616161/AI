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
 keywords="travel,trip planner,itinerary,ai,translator,offline,vacation,city guide,packing,visa,jet lag",
 promo="Upload your tickets and Yola plans every day around them — then replans in a tap when it rains or your train is late.",
 short="AI trip planner: day-by-day plans, live translation, offline mode and more.",
 bullets=["Upload tickets and hotel bookings — AI reads them and builds your trip", "Day-by-day plans for your budget and travel companions", "\"Change the plan\": rain, delays or tiredness? Replan the rest of the day in seconds", "Places verified on Google, open-now spots, weather and hotel ideas", "Live two-way conversation translation, text and menu photos", "Works offline: plan, tickets and emergency phrases on your phone", "Expenses and bill splitting, smart packing list, visa info, jet lag plan", "Trip report with ratings and a shareable card", "Optional social mode: meet travelers in public places, safely"],
 intro="Yola is your AI travel companion. It plans your trip around your real bookings, adapts in the moment and helps you understand and be understood anywhere.",
 plans="Free to start. Yola Pro (monthly or yearly) or a one-time Trip Pass unlocks unlimited planning, replanning and translation."),
"tr": dict(asc="tr", play="tr-TR",
 subtitle="AI seyahat planı ve çeviri",
 keywords="seyahat,gezi planı,rota,yapay zeka,çeviri,çevrimdışı,tatil,şehir rehberi,bavul,vize,jet lag",
 promo="Biletlerini yükle, Yola her günü onların etrafında planlasın — yağmur yağınca veya tren gecikince tek dokunuşla yeniden planlasın.",
 short="AI seyahat asistanı: gün gün plan, canlı çeviri, çevrimdışı mod ve daha fazlası.",
 bullets=["Bilet ve otel rezervasyonlarını yükle — AI okur ve seyahatini kurar", "Bütçene ve yol arkadaşlarına göre gün gün plan", "\"Planı Değiştir\": yağmur, rötar, yorgunluk mu? Günün kalanını saniyeler içinde yeniden planla", "Google'da doğrulanmış mekanlar, şu an açık yerler, hava durumu ve otel önerileri", "Canlı iki yönlü konuşma çevirisi, metin ve menü fotoğrafı çevirisi", "Çevrimdışı çalışır: plan, biletler ve acil durum cümleleri telefonunda", "Harcama ve hesap bölüşme, akıllı bavul listesi, vize bilgisi, jet lag planı", "Puanlı seyahat raporu ve paylaşılabilir kart", "İsteğe bağlı sosyal mod: gezginlerle güvenle, halka açık yerlerde buluş"],
 intro="Yola, yapay zeka destekli seyahat arkadaşın. Seyahatini gerçek rezervasyonlarının etrafında planlar, anında uyum sağlar ve her yerde anlaşmana yardım eder.",
 plans="Ücretsiz başla. Yola Pro (aylık veya yıllık) ya da tek seferlik Trip Pass ile sınırsız planlama, yeniden planlama ve çeviri."),
"es": dict(asc="es-ES", play="es-ES",
 subtitle="Planificador de viajes con IA",
 keywords="viaje,planificador,itinerario,ia,traductor,sin conexión,vacaciones,guía,maleta,visado,jet lag",
 promo="Sube tus billetes y Yola planifica cada día a su alrededor; y si llueve o tu tren se retrasa, replanifica en un toque.",
 short="Planificador de viajes con IA: plan diario, traducción en vivo y modo offline.",
 bullets=["Sube billetes y reservas de hotel: la IA los lee y crea tu viaje", "Planes día a día según tu presupuesto y acompañantes", "\"Cambiar el plan\": ¿lluvia, retrasos o cansancio? Replanifica el resto del día en segundos", "Lugares verificados en Google, abiertos ahora, tiempo e ideas de hotel", "Traducción de conversaciones en vivo, texto y fotos de menús", "Funciona sin conexión: plan, billetes y frases de emergencia en tu móvil", "Gastos y cuentas compartidas, lista de equipaje, visados y plan contra el jet lag", "Informe del viaje con valoraciones y tarjeta para compartir", "Modo social opcional: conoce viajeros en lugares públicos, con seguridad"],
 intro="Yola es tu compañero de viaje con IA. Planifica en torno a tus reservas reales, se adapta al momento y te ayuda a entender y hacerte entender en cualquier lugar.",
 plans="Empieza gratis. Yola Pro (mensual o anual) o un Trip Pass de pago único desbloquean planificación, replanificación y traducción ilimitadas."),
"fr": dict(asc="fr-FR", play="fr-FR",
 subtitle="Planificateur de voyage IA",
 keywords="voyage,itinéraire,planificateur,ia,traducteur,hors ligne,vacances,guide,valise,visa,décalage",
 promo="Importez vos billets : Yola planifie chaque jour autour d’eux, et replanifie en un geste s’il pleut ou si votre train a du retard.",
 short="Voyage avec l’IA : plan jour par jour, traduction en direct, mode hors ligne.",
 bullets=["Importez billets et réservations d’hôtel : l’IA les lit et crée votre voyage", "Plans jour par jour selon votre budget et vos compagnons", "« Changer le plan » : pluie, retard ou fatigue ? Replanifiez la fin de journée en quelques secondes", "Lieux vérifiés sur Google, ouverts maintenant, météo et idées d’hôtels", "Traduction de conversation en direct, texte et photos de menus", "Fonctionne hors ligne : plan, billets et phrases d’urgence sur votre téléphone", "Dépenses et partage des frais, liste de valise, visas, plan décalage horaire", "Bilan du voyage avec notes et carte à partager", "Mode social facultatif : rencontrez des voyageurs dans des lieux publics, en sécurité"],
 intro="Yola est votre compagnon de voyage IA. Il planifie autour de vos vraies réservations, s’adapte sur le moment et vous aide à comprendre et à vous faire comprendre partout.",
 plans="Gratuit pour commencer. Yola Pro (mensuel ou annuel) ou un Trip Pass unique débloque planification, replanification et traduction illimitées."),
"de": dict(asc="de-DE", play="de-DE",
 subtitle="KI-Reiseplaner & Übersetzer",
 keywords="reise,reiseplaner,route,ki,übersetzer,offline,urlaub,stadtführer,packliste,visum,jetlag",
 promo="Lade deine Tickets hoch, und Yola plant jeden Tag drumherum – und plant mit einem Tipp neu, wenn es regnet oder der Zug Verspätung hat.",
 short="KI-Reiseplaner: Tagespläne, Live-Übersetzung, Offline-Modus und mehr.",
 bullets=["Tickets und Hotelbuchungen hochladen – die KI liest sie und baut deine Reise", "Tagespläne passend zu Budget und Mitreisenden", "„Plan ändern“: Regen, Verspätung oder müde? Den Rest des Tages in Sekunden neu planen", "Bei Google geprüfte Orte, jetzt geöffnet, Wetter und Hotelideen", "Live-Gesprächsübersetzung, Text und Fotos von Speisekarten", "Funktioniert offline: Plan, Tickets und Notfallsätze auf dem Handy", "Ausgaben und Kostenteilung, smarte Packliste, Visuminfo, Jetlag-Plan", "Reisebericht mit Bewertungen und teilbarer Karte", "Optionaler Social-Modus: Reisende sicher an öffentlichen Orten treffen"],
 intro="Yola ist dein KI-Reisebegleiter. Es plant rund um deine echten Buchungen, passt sich spontan an und hilft dir, überall zu verstehen und verstanden zu werden.",
 plans="Kostenlos starten. Yola Pro (monatlich oder jährlich) oder ein einmaliger Trip Pass schaltet unbegrenztes Planen, Umplanen und Übersetzen frei."),
"it": dict(asc="it", play="it-IT",
 subtitle="Pianificatore di viaggi con IA",
 keywords="viaggio,itinerario,pianificatore,ia,traduttore,offline,vacanze,guida,valigia,visto,jet lag",
 promo="Carica i biglietti e Yola pianifica ogni giorno attorno a loro; se piove o il treno è in ritardo, ripianifica con un tocco.",
 short="Pianificatore di viaggi con IA: piano giornaliero, traduzione live e offline.",
 bullets=["Carica biglietti e prenotazioni: l’IA li legge e crea il tuo viaggio", "Piani giorno per giorno in base a budget e compagni di viaggio", "\"Cambia piano\": pioggia, ritardi o stanchezza? Ripianifica il resto della giornata in pochi secondi", "Luoghi verificati su Google, aperti ora, meteo e idee per l’hotel", "Traduzione live delle conversazioni, testo e foto dei menu", "Funziona offline: piano, biglietti e frasi di emergenza sul telefono", "Spese e conti divisi, valigia intelligente, info visti, piano jet lag", "Resoconto del viaggio con valutazioni e scheda da condividere", "Modalità social facoltativa: incontra viaggiatori in luoghi pubblici, in sicurezza"],
 intro="Yola è il tuo compagno di viaggio con IA. Pianifica attorno alle tue prenotazioni reali, si adatta al momento e ti aiuta a capire e farti capire ovunque.",
 plans="Inizia gratis. Yola Pro (mensile o annuale) o un Trip Pass una tantum sbloccano pianificazione, ripianificazione e traduzione illimitate."),
"ru": dict(asc="ru", play="ru-RU",
 subtitle="ИИ-планировщик поездок",
 keywords="путешествия,маршрут,планировщик,ии,переводчик,офлайн,отпуск,гид,чемодан,виза,джетлаг",
 promo="Загрузите билеты — Yola распланирует каждый день вокруг них и мгновенно перестроит план, если пошёл дождь или задержали поезд.",
 short="ИИ-планировщик поездок: план по дням, живой перевод и офлайн-режим.",
 bullets=["Загрузите билеты и брони отелей — ИИ прочитает их и соберёт поездку", "План по дням с учётом бюджета и попутчиков", "«Изменить план»: дождь, задержка или усталость? Новый план на остаток дня за секунды", "Проверенные в Google места, открытые сейчас заведения, погода и отели", "Живой перевод разговора в обе стороны, текста и фото меню", "Работает офлайн: план, билеты и экстренные фразы в телефоне", "Расходы и деление счёта, умный список вещей, визы, план против джетлага", "Итоги поездки с оценками и карточкой для публикации", "Необязательный социальный режим: безопасные встречи с путешественниками в людных местах"],
 intro="Yola — ваш ИИ-спутник в путешествиях. Он планирует поездку вокруг реальных броней, подстраивается на ходу и помогает понимать и быть понятым где угодно.",
 plans="Начните бесплатно. Yola Pro (месяц или год) или разовый Trip Pass открывают безлимитное планирование, перепланирование и перевод."),
"ar": dict(asc="ar-SA", play="ar",
 subtitle="مخطط رحلات ومترجم بالذكاء",
 keywords="سفر,رحلة,مخطط رحلات,ذكاء اصطناعي,مترجم,دون اتصال,عطلة,دليل,حقيبة,تأشيرة",
 promo="ارفع تذاكرك ليخطط Yola كل يوم حولها، ويعيد التخطيط بلمسة إذا أمطرت أو تأخر قطارك.",
 short="مخطط رحلات بالذكاء الاصطناعي: خطة يومية وترجمة فورية ووضع دون اتصال.",
 bullets=["ارفع التذاكر وحجوزات الفنادق، ويقرؤها الذكاء الاصطناعي ويبني رحلتك", "خطط يومية حسب ميزانيتك ورفاق سفرك", "«غيّر الخطة»: مطر أو تأخير أو تعب؟ أعد تخطيط بقية اليوم في ثوانٍ", "أماكن موثّقة على Google ومفتوحة الآن، والطقس واقتراحات الفنادق", "ترجمة محادثات فورية في الاتجاهين، وترجمة النصوص وصور قوائم الطعام", "يعمل دون اتصال: الخطة والتذاكر وعبارات الطوارئ على هاتفك", "المصاريف وتقسيم الحساب، وقائمة حقيبة ذكية، ومعلومات التأشيرة، وخطة فرق التوقيت", "تقرير رحلة بالتقييمات وبطاقة للمشاركة", "وضع اجتماعي اختياري: التقِ بالمسافرين بأمان في الأماكن العامة"],
 intro="Yola رفيقك في السفر بالذكاء الاصطناعي. يخطط رحلتك حول حجوزاتك الحقيقية، ويتكيّف في اللحظة، ويساعدك على الفهم والتفاهم في أي مكان.",
 plans="ابدأ مجانًا. يفتح Yola Pro (شهري أو سنوي) أو Trip Pass لمرة واحدة التخطيط وإعادة التخطيط والترجمة بلا حدود."),
"zh": dict(asc="zh-Hans", play="zh-CN",
 subtitle="AI 旅行规划与翻译",
 keywords="旅行,行程规划,攻略,人工智能,翻译,离线,度假,城市指南,行李清单,签证,倒时差",
 promo="上传机票，Yola 围绕它规划每一天；下雨或火车晚点时，一键重新规划。",
 short="AI 旅行规划：每日行程、实时翻译、离线模式等。",
 bullets=["上传机票和酒店预订，AI 自动识别并生成行程", "根据预算和同行人规划每日行程", "「调整计划」：下雨、延误或疲惫？几秒钟重新规划当天剩余行程", "经 Google 验证的地点、正在营业的店铺、天气和酒店推荐", "实时双向对话翻译、文本和菜单照片翻译", "离线可用：行程、票据和紧急用语都在手机上", "记账与分摊、智能行李清单、签证信息、倒时差计划", "带评分的旅行报告和可分享卡片", "可选社交模式：在公共场所安全结识旅伴"],
 intro="Yola 是你的 AI 旅行伙伴。它围绕你的真实预订规划行程，随时调整，并帮助你在任何地方沟通无碍。",
 plans="免费开始。Yola Pro（月付或年付）或一次性 Trip Pass 解锁无限规划、调整和翻译。"),
}
NAME = "Yola: AI Travel Planner"
root = os.path.dirname(os.path.abspath(__file__))
problems = []
for lang, d in L.items():
    desc = d["intro"] + "\n\n" + "\n".join(f"• {b}" for b in d["bullets"]) + "\n\n" + d["plans"]
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
