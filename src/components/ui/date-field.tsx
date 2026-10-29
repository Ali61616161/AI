import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { clampIsoDate, formatClock, formatIsoDate, parseClock, parseIsoDate } from '@/lib/date-input';
import { formatDayShort, todayIsoDate } from '@/lib/format';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Text } from './text';

type CommonProps = { label: string; error?: string | null; hint?: string; optional?: boolean };

function Frame({ label, error, hint, children }: CommonProps & { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text variant="overline" color="textMuted" style={styles.label}>
        {label}
      </Text>
      <View style={[styles.box, { backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border }]}>{children}</View>
      {error ? (
        <Text variant="caption" color="danger">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Takvimden gün seçme. Değer "YYYY-AA-GG" ya da boş. iOS'ta yerleşik takvim açılır, Android'de iletişim kutusu.
 * Boşken "Seç"e basınca `min` (yoksa bugün) seçilir ve seçici açılır.
 */
export function DateField({ label, value, onChange, min, max, error, hint, optional }: CommonProps & { value: string; onChange: (v: string) => void; min?: string | null; max?: string | null }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const date = parseIsoDate(value);
  const fallback = parseIsoDate(clampIsoDate(todayIsoDate(), min, max)) ?? new Date();
  const minimumDate = min ? (parseIsoDate(min) ?? undefined) : undefined;
  const maximumDate = max ? (parseIsoDate(max) ?? undefined) : undefined;
  const handle = (d: Date) => onChange(clampIsoDate(formatIsoDate(d), min, max));

  return (
    <Frame label={label} error={error} hint={hint}>
      {Platform.OS === 'ios' && date ? (
        <View style={styles.row}>
          <DateTimePicker value={date} mode="date" display="compact" minimumDate={minimumDate} maximumDate={maximumDate} accentColor={colors.primary} themeVariant={isDark ? 'dark' : 'light'} onValueChange={(_e, d) => handle(d)} />
          <View style={styles.flex} />
          {optional && (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.clear')} hitSlop={8} onPress={() => onChange('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => {
            if (Platform.OS === 'ios') handle(fallback);
            else setOpen(true);
          }}
          style={styles.row}>
          <Ionicons name="calendar-outline" size={20} color={colors.primary} />
          <Text variant="body" color={date ? 'text' : 'textMuted'} style={styles.flex}>
            {date ? formatDayShort(value) : t('common.pickDate')}
          </Text>
          {optional && date && (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.clear')} hitSlop={8} onPress={() => onChange('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </Pressable>
      )}
      {Platform.OS === 'android' && open && (
        <DateTimePicker
          value={date ?? fallback}
          mode="date"
          minimumDate={minimumDate}
          maximumDate={maximumDate}
          onValueChange={(_e, d) => {
            setOpen(false);
            handle(d);
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </Frame>
  );
}

/** Saat seçme ("HH:mm" ya da boş). */
export function TimeField({ label, value, onChange, error, hint, optional = true }: CommonProps & { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation();
  const { colors, isDark } = useTheme();
  const [open, setOpen] = useState(false);
  const time = parseClock(value);
  const fallback = (() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  })();

  return (
    <Frame label={label} error={error} hint={hint}>
      {Platform.OS === 'ios' && time ? (
        <View style={styles.row}>
          <DateTimePicker value={time} mode="time" display="compact" accentColor={colors.primary} themeVariant={isDark ? 'dark' : 'light'} onValueChange={(_e, d) => onChange(formatClock(d))} />
          <View style={styles.flex} />
          {optional && (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.clear')} hitSlop={8} onPress={() => onChange('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          onPress={() => {
            if (Platform.OS === 'ios') onChange(formatClock(fallback));
            else setOpen(true);
          }}
          style={styles.row}>
          <Ionicons name="time-outline" size={20} color={colors.primary} />
          <Text variant="body" color={time ? 'text' : 'textMuted'} style={styles.flex}>
            {time ? formatClock(time) : t('common.pickTime')}
          </Text>
          {optional && time && (
            <Pressable accessibilityRole="button" accessibilityLabel={t('common.clear')} hitSlop={8} onPress={() => onChange('')}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          )}
        </Pressable>
      )}
      {Platform.OS === 'android' && open && (
        <DateTimePicker
          value={time ?? fallback}
          mode="time"
          is24Hour
          onValueChange={(_e, d) => {
            setOpen(false);
            onChange(formatClock(d));
          }}
          onDismiss={() => setOpen(false)}
        />
      )}
    </Frame>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  label: { marginLeft: Spacing.xs },
  box: { minHeight: 52, borderRadius: Radius.md, borderWidth: 1, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flex: { flex: 1 },
});
