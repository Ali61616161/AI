import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';

import i18n from '@/i18n';

import { nudgeAt, type DriftStop, type StopMark } from './drift-logic';

const keyFor = (tripId: string) => `yola.liveNudges.${tripId}`;

/**
 * Bugünün işaretlenmemiş duraklarının saatinden 25 dakika sonrası için "yolda mısın?" bildirimi kurar.
 * Önceki bildirimler iptal edilir; serbest günde hiçbiri kurulmaz. İzin yoksa sessizce vazgeçer.
 */
let queue: Promise<unknown> = Promise.resolve();

/** Çağrılar sırayla çalışır; üst üste tetiklenince bildirimler ikilenmez. */
export function scheduleStopNudges(...args: Parameters<typeof scheduleStopNudgesNow>): Promise<void> {
  const run = queue.then(() => scheduleStopNudgesNow(...args));
  queue = run.catch(() => undefined);
  return run;
}

async function scheduleStopNudgesNow(tripId: string, stops: DriftStop[], marks: Record<string, StopMark>, freeDay: boolean, extra?: { id: string; at: Date; title: string; body: string }): Promise<void> {
  const permission = await Notifications.getPermissionsAsync();
  if (!permission.granted) return;
  const previous: string[] = JSON.parse((await AsyncStorage.getItem(keyFor(tripId))) ?? '[]');
  await Promise.all(previous.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => undefined)));
  const ids: string[] = [];
  const url = `/trip-live?tripId=${tripId}`;
  const now = Date.now();
  if (!freeDay) {
    for (const stop of stops) {
      if (marks[stop.id]) continue;
      const at = nudgeAt(stop.starts_at, now);
      if (!at) continue;
      ids.push(
        await Notifications.scheduleNotificationAsync({
          content: { title: i18n.t('live.nudge.title', { title: stop.title }), body: i18n.t('live.nudge.body'), data: { url } },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at },
        }),
      );
    }
  }
  if (extra && extra.at.getTime() > now) {
    ids.push(
      await Notifications.scheduleNotificationAsync({
        content: { title: extra.title, body: extra.body, data: { url } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: extra.at },
      }),
    );
  }
  await AsyncStorage.setItem(keyFor(tripId), JSON.stringify(ids));
}
