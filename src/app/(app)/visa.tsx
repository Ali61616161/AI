import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { SelectSheet } from '@/components/ui/select-sheet';
import { Text } from '@/components/ui/text';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import { ToolError, useProfileCountries, useSavePassport, useVisaInfo } from '@/features/tools/api';
import { COUNTRIES, localCountryName } from '@/features/tools/countries';
import { flag } from '@/features/tools/emergency-numbers';
import { useTrip } from '@/features/trips/queries';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';
import { RewardedButton } from '@/features/ads/rewarded-button';
import { AccessBadge } from '@/features/identity/access-badge';
import { useSessionStore } from '@/stores/session-store';

const TONE = {
  visa_free: 'success',
  freedom_of_movement: 'success',
  visa_on_arrival: 'warning',
  evisa: 'warning',
  visa_required: 'danger',
  unknown: 'textSecondary',
} as const;

/** Vize ve giriş koşulları (AI ile genel bilgi; resmi kaynaktan doğrulanmalı). */
export default function VisaScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { tripId, destination: destParam } = useLocalSearchParams<{ tripId?: string; destination?: string }>();
  const { data: trip } = useTrip(tripId);
  const { data: profile } = useProfileCountries();
  const savePassport = useSavePassport();
  const identity = useSessionStore((s) => s.identity);
  const setIdentity = useSessionStore((s) => s.setIdentity);
  const [destination, setDestination] = useState<string | null>(destParam ?? null);
  const dest = destination ?? trip?.trip_destinations[0]?.country_code ?? null;
  const passport = profile?.passport_country ?? identity.passport ?? null;
  const visa = useVisaInfo(passport, dest);

  const options = useMemo(
    () =>
      COUNTRIES.map((c) => ({ value: c.code, label: `${flag(c.code)}  ${localCountryName(c.code, i18n.language)}` })).sort((a, b) =>
        a.label.slice(4).localeCompare(b.label.slice(4), i18n.language),
      ),
    [i18n.language],
  );

  const errorCode = visa.error instanceof ToolError ? visa.error.code : visa.error ? 'network' : null;
  const data = visa.data;

  return (
    <Screen>
      <ModalHeader title={t('visa.title')} subtitle={t('visa.subtitle')} />
      <Text variant="overline" color="textMuted">
        {t('visa.passport')}
      </Text>
      <SelectSheet label={t('visa.passport')} value={passport} options={options} placeholder={t('visa.choose')} onChange={(c) => {
          setIdentity({ passport: c });
          if (useSessionStore.getState().session) savePassport.mutate(c);
        }} />
      <Text variant="overline" color="textMuted">
        {t('visa.destination')}
      </Text>
      <SelectSheet label={t('visa.destination')} value={dest} options={options} placeholder={t('visa.choose')} onChange={setDestination} />

      {passport && dest && <AccessBadge passports={[passport, ...identity.otherPassports.filter((p) => p !== passport)]} extras={identity.extraVisas} destination={dest} />}

      {visa.isFetching ? (
        <ActivityIndicator />
      ) : errorCode ? (
        <>
          <Text variant="caption" color={errorCode === 'quota_exceeded' ? 'warning' : 'danger'}>
            {t(`visa.errors.${errorCode}`)}
          </Text>
          {errorCode === 'quota_exceeded' && <UpgradeButton />}
          {errorCode === 'quota_exceeded' && <RewardedButton feature="travel_info" />}
        </>
      ) : (
        data && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.badge}>
              <Ionicons name={data.requirement === 'visa_required' ? 'document-lock-outline' : data.requirement === 'unknown' ? 'help-circle-outline' : 'checkmark-circle-outline'} size={22} color={colors[TONE[data.requirement]]} />
              <Text variant="title" color={TONE[data.requirement]} style={styles.flex}>
                {t(`visa.requirement.${data.requirement}`)}
              </Text>
            </View>
            {data.maxStayDays && (
              <Text variant="bodyStrong">{t('visa.maxStay', { count: data.maxStayDays })}</Text>
            )}
            <Text variant="body">{data.summary}</Text>
            {data.documents.length > 0 && (
              <View style={styles.list}>
                <Text variant="subtitle">{t('visa.documents')}</Text>
                {data.documents.map((d) => (
                  <Text key={d} variant="body">
                    • {d}
                  </Text>
                ))}
              </View>
            )}
            {data.notes.length > 0 && (
              <View style={styles.list}>
                <Text variant="subtitle">{t('visa.notes')}</Text>
                {data.notes.map((d) => (
                  <Text key={d} variant="body">
                    • {d}
                  </Text>
                ))}
              </View>
            )}
            {data.officialUrl && <Button title={t('visa.official')} variant="secondary" onPress={() => Linking.openURL(data.officialUrl!)} />}
          </View>
        )
      )}

      <View style={[styles.warning, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name="alert-circle-outline" size={18} color={colors.warning} />
        <Text variant="caption" style={styles.flex}>
          {t('visa.disclaimer')}
        </Text>
      </View>
      <Button title={t('visa.iata')} variant="ghost" onPress={() => Linking.openURL('https://www.iatatravelcentre.com/')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
  list: { gap: Spacing.xxs },
  warning: { flexDirection: 'row', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.md },
});
