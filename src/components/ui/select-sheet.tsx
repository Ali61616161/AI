import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

type Option = { value: string; label: string };

/** Uzun listelerden seçim: düğmeye dokununca aranabilir liste açılır. */
export function SelectSheet({ label, value, options, placeholder, onChange }: { label: string; value: string | null; options: Option[]; placeholder: string; onChange: (value: string) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const current = options.find((o) => o.value === value);
  const q = query.trim().toLocaleLowerCase();
  const filtered = q ? options.filter((o) => o.label.toLocaleLowerCase().includes(q) || o.value.toLowerCase() === q) : options;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? placeholder}`}
        onPress={() => setOpen(true)}
        style={[styles.button, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text variant="bodyStrong" numberOfLines={1} color={current ? 'text' : 'textMuted'} style={styles.flex}>
          {current?.label ?? placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
      </Pressable>
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={[styles.sheet, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <Text variant="title">{label}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={() => setOpen(false)} hitSlop={12}>
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>
          </View>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('common.search')}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={t('common.search')}
            style={[Typography.body, styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + Spacing.xl }}>
            {filtered.map((o) => (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: o.value === value }}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                  setQuery('');
                }}
                style={[styles.option, { borderColor: colors.border }]}>
                <Text variant="body" style={styles.flex}>
                  {o.label}
                </Text>
                {o.value === value && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  flex: { flex: 1 },
  sheet: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, gap: Spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  search: { padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  option: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: StyleSheet.hairlineWidth },
});
