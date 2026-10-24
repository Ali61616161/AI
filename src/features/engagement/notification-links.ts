import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { isAllowedNotificationPath } from '@/lib/safe-url';

/** Aynı bildirim yanıtı (ör. yeniden girişten sonra) ikinci kez açılmasın. */
let handled: string | null = null;

/** Bildirime dokunulunca içindeki seyahat ekranına gider (yalnızca izinli seyahat yolları). */
export function useNotificationLinks() {
  const last = Notifications.useLastNotificationResponse();
  useEffect(() => {
    if (!last) return;
    const id = `${last.notification.request.identifier}|${last.notification.date}`;
    if (handled === id) return;
    handled = id;
    const url = last.notification.request.content.data?.url;
    if (isAllowedNotificationPath(url)) router.push(url as never);
  }, [last]);
}
