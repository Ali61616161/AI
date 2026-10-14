import type { TFunction } from 'i18next';

import type { ActivePlan, TripListItem } from '@/features/trips/queries';
import { daysUntil, formatDayShort, formatTime, todayIsoDate } from '@/lib/format';

import type { TodaysPlanWidgetProps } from './types';

const MAX_ITEMS = 3;
const MAX_ENTRIES = 8;

/** Sürmekte olan seyahat; yoksa en yakın gelecek seyahat. */
export function pickWidgetTrip(trips: TripListItem[] | undefined, now = new Date()): TripListItem | undefined {
  const today = todayIsoDate(now);
  const live = trips?.filter((t) => t.start_date && (!t.end_date || t.end_date >= today));
  return live?.find((t) => t.start_date! <= today) ?? live?.find((t) => t.start_date! > today);
}

/**
 * Widget zaman çizelgesi: şimdi için bir kayıt, sonra bugünkü her kalemin başlangıcında
 * (geçen kalem listeden düşsün diye) yeni bir kayıt. Metinler uygulamanın dilinde çevrilir.
 */
export function buildWidgetTimeline(
  t: TFunction,
  trip: TripListItem | undefined,
  plan: ActivePlan | null | undefined,
  scheme: string,
  now = new Date(),
): { date: Date; props: TodaysPlanWidgetProps }[] {
  const base = { heading: t('widget.title'), url: `${scheme}://` };
  if (!trip?.start_date) {
    return [{ date: now, props: { ...base, city: '', subtitle: '', items: [], emptyText: t('widget.noTrip') } }];
  }

  const today = todayIsoDate(now);
  const started = trip.start_date <= today;
  const total = trip.end_date ? daysUntil(trip.end_date, new Date(`${trip.start_date}T12:00:00`)) + 1 : 0;
  const dayNumber = started ? -daysUntil(trip.start_date, now) + 1 : 1;
  const day = plan?.day_plans.find((d) => d.date === (started ? today : trip.start_date));
  const city = day?.city ?? trip.trip_destinations[0]?.city ?? trip.title;
  const subtitle = started
    ? total > 0
      ? t('widget.dayOf', { day: dayNumber, total })
      : t('widget.day', { day: dayNumber })
    : t('widget.startsOn', { date: formatDayShort(trip.start_date) });
  const url = `${scheme}://trip/${trip.id}`;

  const items = (day?.plan_items ?? []).filter((i) => i.status === 'planned');
  const emptyText = !plan ? t('widget.noPlan') : started ? t('widget.dayDone') : t('widget.noPlan');

  const propsFrom = (from: Date): TodaysPlanWidgetProps => {
    const upcoming = started
      ? items.filter((i) => !i.starts_at || Date.parse(i.ends_at ?? i.starts_at) > from.getTime())
      : items;
    return {
      ...base,
      url,
      city,
      subtitle,
      emptyText,
      items: upcoming.slice(0, MAX_ITEMS).map((i) => ({
        time: i.starts_at ? formatTime(i.starts_at, i.timezone) : '',
        title: i.place_name || i.title,
      })),
    };
  };

  const entries = [{ date: now, props: propsFrom(now) }];
  if (started) {
    for (const item of items) {
      const end = item.ends_at ?? item.starts_at;
      if (!end) continue;
      const at = new Date(end);
      if (at.getTime() <= now.getTime() || entries.length >= MAX_ENTRIES) continue;
      entries.push({ date: at, props: propsFrom(new Date(at.getTime() + 1000)) });
    }
  }
  return entries;
}
