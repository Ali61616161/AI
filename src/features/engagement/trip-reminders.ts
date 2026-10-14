import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import i18n from '@/i18n';

import { tripReminderDates, type ReminderTrip } from './trip-reminder-logic';

const KEY = 'yola.tripReminders';

/**
 * Seyahat öncesi hatırlatmaları yeniden kurar (önceki planlananlar iptal edilir).
 * Bildirim izni yoksa sessizce vazgeçer; izin ilk seyahat oluşturulunca istenir.
 */
export async function scheduleTripReminders(trips: ReminderTrip[]): Promise<void> {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  const previous: string[] = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
  await Promise.all(previous.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  const ids: string[] = [];
  for (const r of tripReminderDates(trips, Date.now())) {
    const city = r.city ?? i18n.t('engagement.tripReminder.yourTrip');
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content: {
          title: i18n.t(`engagement.tripReminder.${r.kind}.title`, { city }),
          body: i18n.t(`engagement.tripReminder.${r.kind}.body`, { city }),
          data: { url: `/trip/${r.tripId}` },
        },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date },
      }),
    );
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(ids));
}
