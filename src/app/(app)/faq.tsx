import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import brand from '@/config/brand.json';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const ITEMS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

/** Yardım ve destek: sık sorulan sorular (dokununca açılır) ve destek e-postası. */
export default function FaqScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [open, setOpen] = useState<number | null>(null);

  return (
    <Screen>
      <ModalHeader title={t('profile.help')} subtitle={t('faq.title')} />
      {ITEMS.map((n) => {
        const expanded = open === n;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            onPress={() => setOpen(expanded ? null : n)}
            style={[styles.item, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.row}>
              <Text variant="bodyStrong" style={styles.flex}>
                {t(`faq.q${n}`)}
              </Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
            </View>
            {expanded && <Text variant="body">{t(`faq.a${n}`)}</Text>}
          </Pressable>
        );
      })}
      <View style={styles.contact}>
        <Text variant="caption" color="textSecondary">
          {t('faq.notFound')}
        </Text>
        <Button
          title={t('faq.email')}
          variant="secondary"
          onPress={() => Linking.openURL(`mailto:${brand.legal.supportEmail}?subject=${encodeURIComponent(t('profile.helpSubject'))}`).catch(() => undefined)}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: { gap: Spacing.sm, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  contact: { gap: Spacing.sm, alignItems: 'flex-start' },
});
