import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Brand } from '@/config/brand';
import { fillLegal, LEGAL, type LegalLanguage } from '@/features/legal/content';
import { Spacing } from '@/theme/tokens';

/** Gizlilik politikası ve kullanım koşulları (Türkçe veya İngilizce). */
export default function LegalScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ doc?: 'privacy' | 'terms' }>();
  const [doc, setDoc] = useState<'privacy' | 'terms'>(params.doc ?? 'privacy');
  const lang: LegalLanguage = i18n.language === 'tr' ? 'tr' : 'en';
  const content = LEGAL[lang][doc];
  const values = Brand.legal as unknown as Record<string, string>;

  return (
    <Screen>
      <ModalHeader title={content.title} subtitle={t('legal.effective', { date: Brand.legal.effectiveDate })} />
      <View style={styles.chips}>
        <Chip label={LEGAL[lang].privacy.title} selected={doc === 'privacy'} onPress={() => setDoc('privacy')} />
        <Chip label={LEGAL[lang].terms.title} selected={doc === 'terms'} onPress={() => setDoc('terms')} />
      </View>
      {lang === 'en' && i18n.language !== 'en' && (
        <Text variant="caption" color="textMuted">
          {t('legal.englishOnly')}
        </Text>
      )}
      {content.sections.map((s) => (
        <View key={s.heading} style={styles.section}>
          <Text variant="subtitle">{s.heading}</Text>
          <Text variant="body" color="textSecondary" selectable>
            {fillLegal(s.body, values)}
          </Text>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', gap: Spacing.sm },
  section: { gap: Spacing.xs },
});
