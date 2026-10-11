import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { TRANSLATE_LANGUAGES, translateLanguage } from './languages';

/** Dil seçme düğmesi; dokununca tüm dillerin listesi açılır. "auto" otomatik algılamadır. */
export function LanguagePicker({ value, onChange, allowAuto = false, label }: { value: string; onChange: (code: string) => void; allowAuto?: boolean; label: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const name = value === 'auto' ? t('translate.autoDetect') : translateLanguage(value).name;
  const options = [...(allowAuto ? [{ code: 'auto', name: t('translate.autoDetect') }] : []), ...TRANSLATE_LANGUAGES];

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${name}`}
        onPress={() => setOpen(true)}
        style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="bodyStrong" numberOfLines={1} style={styles.flex}>
          {name}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingTop: Spacing.lg }]}>
          <View style={styles.header}>
            <Text variant="title">{label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
            {options.map((o) => (
              <Pressable
                key={o.code}
                accessibilityRole="radio"
                accessibilityState={{ checked: o.code === value }}
                onPress={() => {
                  onChange(o.code);
                  setOpen(false);
                }}
                style={[styles.option, { borderColor: colors.border }]}>
                <Text variant="body" style={styles.flex}>
                  {o.name}
                </Text>
                {o.code === value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  flex: { flex: 1 },
  sheet: { flex: 1, paddingHorizontal: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: Spacing.md },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
