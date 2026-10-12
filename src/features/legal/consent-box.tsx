import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';

import { CheckRow } from '@/components/ui/check-row';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/theme/tokens';

import type { LegalDocKey } from './content';

type Value = { accepted: boolean; marketing: boolean };

function DocLink({ doc, children }: { doc: LegalDocKey; children?: React.ReactNode }) {
  return (
    <Text variant="caption" color="primary" style={styles.link} onPress={() => router.push({ pathname: '/legal', params: { doc } })} accessibilityRole="link">
      {children}
    </Text>
  );
}

/**
 * Kayıt/giriş ekranındaki sözleşme onayları. Koşullar ve gizlilik zorunlu tek kutu
 * (aydınlatma metni okunur, onaylanmaz); ticari ileti isteğe bağlı ve ayrı kutudur.
 */
export function ConsentBox({ value, onChange }: { value: Value; onChange: (v: Value) => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.box}>
      <CheckRow checked={value.accepted} onChange={(accepted) => onChange({ ...value, accepted })} label={t('consent.termsLabel')}>
        <Text variant="caption" color="textSecondary">
          <Trans
            i18nKey="consent.terms"
            components={{ terms: <DocLink doc="terms" />, privacy: <DocLink doc="privacy" />, kvkk: <DocLink doc="kvkk" /> }}
          />
        </Text>
      </CheckRow>
      <CheckRow checked={value.marketing} onChange={(marketing) => onChange({ ...value, marketing })} label={t('consent.marketing')}>
        <Text variant="caption" color="textSecondary">
          {t('consent.marketing')}
        </Text>
      </CheckRow>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.md },
  link: { textDecorationLine: 'underline' },
});
