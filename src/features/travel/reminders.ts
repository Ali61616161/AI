import { registerPushToken } from '@/features/push/push';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import i18n from '@/i18n';

type Doc = { id: string; kind: string; label: string | null; country_code: string | null; expires_on: string };

const KEY = 'yola.docReminders';
const DAY = 86_400_000;

/** Pasaport: bitişten 6 ay ve 1 ay önce; vize/oturum: 30 ve 7 gün önce (saat 10:00). */
export function reminderDates(doc: Pick<Doc, 'kind' | 'expires_on'>, now = Date.now()): { date: Date; daysBefore: number }[] {
  const expiry = Date.parse(`${doc.expires_on}T10:00:00`);
  const offsets = doc.kind === 'passport' || doc.kind === 'id_card' ? [183, 30] : [30, 7];
  return offsets.map((d) => ({ date: new Date(expiry - d * DAY), daysBefore: d })).filter((r) => r.date.getTime() > now);
}

/**
 * Belge hatırlatmalarını yeniden kurar: önceki planlananlar iptal edilir. Bildirim izni
 * yoksa sessizce vazgeçer (izin, ilk belge eklenirken istenir).
 */
export async function scheduleDocumentReminders(docs: Doc[]): Promise<void> {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  const previous: string[] = JSON.parse((await AsyncStorage.getItem(KEY)) ?? '[]');
  await Promise.all(previous.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  const ids: string[] = [];
  for (const doc of docs) {
    for (const r of reminderDates(doc)) {
      const name = doc.label || i18n.t(`docs.kind.${doc.kind}` as 'docs.kind.passport');
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content: { title: i18n.t('docs.reminderTitle', { name }), body: i18n.t('docs.reminderBody', { count: r.daysBefore, date: doc.expires_on }) },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date },
        }),
      );
    }
  }
  await AsyncStorage.setItem(KEY, JSON.stringify(ids));
}

export async function requestReminderPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const granted = (await Notifications.requestPermissionsAsync()).granted;
  if (granted) registerPushToken().catch(() => undefined);
  return granted;
}
