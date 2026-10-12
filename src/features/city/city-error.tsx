import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import { Spacing } from '@/theme/tokens';

import { CityError } from './api';

/** Şehrim isteklerinin hata durumları: limit (Pro), şehir eksik, servis sorunu. */
export function CityErrorNote({ error }: { error: unknown }) {
  const { t } = useTranslation();
  const code = error instanceof CityError ? error.code : 'network';
  return (
    <Card>
      <View style={styles.box}>
        <Text variant="bodyStrong" color={code === 'quota_exceeded' ? 'warning' : 'danger'}>
          {t(`city.errors.${code}`)}
        </Text>
        {code === 'quota_exceeded' && <UpgradeButton />}
        {code === 'no_home_city' && <Button title={t('city.addCity')} variant="secondary" icon="location" onPress={() => router.push('/passport')} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({ box: { gap: Spacing.sm, alignItems: 'flex-start' } });
