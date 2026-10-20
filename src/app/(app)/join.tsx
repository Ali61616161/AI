import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useAcceptTripInvite } from '@/features/sharing/api';
import { useTheme } from '@/theme/use-theme';

/** yola://join?token=… bağlantısı: daveti kabul edip seyahati açar. */
export default function JoinScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const accept = useAcceptTripInvite();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    accept.mutate(token, { onSuccess: (tripId) => router.replace(`/trip/${tripId}`), onError: () => setFailed(true) });
  }, [token, accept]);

  return (
    <Screen>
      {failed || !token ? (
        <>
          <Text variant="body">{t('share.acceptFailed')}</Text>
          <Button title={t('common.close')} variant="secondary" onPress={() => router.replace('/')} />
        </>
      ) : (
        <>
          <ActivityIndicator color={colors.primary} />
          <Text variant="body" color="textSecondary">
            {t('share.joining')}
          </Text>
        </>
      )}
    </Screen>
  );
}
