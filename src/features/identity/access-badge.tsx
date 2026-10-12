import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { flag } from '@/features/tools/emergency-numbers';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { bestAccess, type AccessStatus } from '../../../supabase/functions/_shared/visa-access.ts';
import { PASSPORT_DATA_UPDATED } from '../../../supabase/functions/_shared/passport-index.ts';
import { VISA_FLAG } from './extra-visas';

export const ACCESS_TONE: Record<AccessStatus, 'success' | 'warning' | 'danger' | 'textSecondary'> = {
  own: 'success',
  visa_free: 'success',
  visa_on_arrival: 'success',
  eta: 'warning',
  evisa: 'warning',
  visa_required: 'danger',
  no_admission: 'danger',
};

export const ACCESS_ICON: Record<AccessStatus, 'home' | 'checkmark-circle' | 'airplane' | 'phone-portrait' | 'document-text' | 'document-lock' | 'ban'> = {
  own: 'home',
  visa_free: 'checkmark-circle',
  visa_on_arrival: 'airplane',
  eta: 'phone-portrait',
  evisa: 'document-text',
  visa_required: 'document-lock',
  no_admission: 'ban',
};

/** Pasaport verisine göre anında giriş durumu (internet gerekmez). */
export function AccessBadge({ passports, extras, destination }: { passports: string[]; extras: string[]; destination: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const access = bestAccess(passports, extras, destination);
  if (!access) return null;
  const tone = ACCESS_TONE[access.status];
  const via = access.via;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors[tone] }]}>
      <View style={styles.row}>
        <Ionicons name={ACCESS_ICON[access.status]} size={22} color={colors[tone]} />
        <Text variant="subtitle" color={tone} style={styles.flex}>
          {t(`access.${access.status}`)}
          {access.days ? ` · ${t('access.days', { count: access.days })}` : ''}
        </Text>
      </View>
      {via.kind === 'visa' ? (
        <>
          <Text variant="caption" color="textSecondary">
            {t('access.viaVisa', { visa: `${VISA_FLAG[via.key] ?? ''} ${t(`visaType.${via.key}`)}` })}
          </Text>
          {via.condition && (
            <Text variant="caption" color="textMuted">
              {t('access.condition')}: {via.condition}
            </Text>
          )}
          {via.source && (
            <Text variant="caption" color="primary" onPress={() => Linking.openURL(via.source!)} accessibilityRole="link">
              {t('access.source')}
            </Text>
          )}
        </>
      ) : (
        passports.length > 1 && (
          <Text variant="caption" color="textSecondary">
            {t('access.viaPassport', { flag: flag(via.code) })}
          </Text>
        )
      )}
      <Text variant="caption" color="textMuted">
        {t('access.dataNote', { date: PASSPORT_DATA_UPDATED })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
});
