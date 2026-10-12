import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Chip } from '@/components/ui/chip';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Brand } from '@/config/brand';
import { fillLegal, LEGAL, type LegalDocKey, type LegalLanguage } from '@/features/legal/content';
import { Spacing } from '@/theme/tokens';

const DOCS: LegalDocKey[] = ['terms', 'privacy', 'kvkk'];

/** Kullanım koşulları, gizlilik politikası ve KVKK aydınlatma metni (Türkçe veya İngilizce). Giriş yapmadan da açılır. */
export default function LegalScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ doc?: LegalDocKey }>();
  const [doc, setDoc] = useState<LegalDocKey>(params.doc && DOCS.includes(params.doc) ? params.doc : 'privacy');
  const lang: LegalLanguage = i18n.language === 'tr' ? 'tr' : 'en';
  const content = LEGAL[lang][doc];
  const values = Brand.legal as unknown as Record<string, string>;

  return (
    <Screen>
      <ModalHeader title={content.title} subtitle={t('legal.effective', { date: Brand.legal.effectiveDate })} />
      <View style={styles.chips}>
        {DOCS.map((d) => (
          <Chip key={d} label={LEGAL[lang][d].title} selected={doc === d} onPress={() => setDoc(d)} />
        ))}
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  section: { gap: Spacing.xs },
});
