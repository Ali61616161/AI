import { Tabs } from 'expo-router/tabs';
import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import { TabBar } from '@/components/navigation/tab-bar';
import { emitTabEntered } from '@/lib/tab-scroll';

/** Sekme değişince (modal açılıp kapanınca değil) açılan sekmeye haber verir. */
function TabEnterWatcher({ index, name }: { index: number; name: string }) {
  const previous = useRef<number | null>(null);
  useEffect(() => {
    if (previous.current !== null && previous.current !== index) emitTabEntered(name);
    previous.current = index;
  }, [index, name]);
  return null;
}

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => (
        <>
          <TabEnterWatcher index={props.state.index} name={props.state.routes[props.state.index].name} />
          <TabBar {...props} />
        </>
      )}>
      <Tabs.Screen name="index" options={{ title: t('tabs.today') }} />
      <Tabs.Screen name="trips" options={{ title: t('tabs.trips') }} />
      <Tabs.Screen name="explore" options={{ title: t('tabs.explore') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
