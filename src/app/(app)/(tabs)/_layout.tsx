import { Tabs } from 'expo-router/tabs';
import { useTranslation } from 'react-i18next';

import { TabBar } from '@/components/navigation/tab-bar';

export default function TabsLayout() {
  const { t } = useTranslation();
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" options={{ title: t('tabs.today') }} />
      <Tabs.Screen name="trips" options={{ title: t('tabs.trips') }} />
      <Tabs.Screen name="social" options={{ title: t('tabs.social') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
