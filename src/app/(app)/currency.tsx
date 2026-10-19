import Ionicons from '@expo/vector-icons/Ionicons';
import { getLocales } from 'expo-localization';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { SelectSheet } from '@/components/ui/select-sheet';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { CURRENCIES } from '@/lib/fx-logic';
import { getRate } from '@/lib/fx';
import { currentLanguage } from '@/i18n';
import { useTheme } from '@/theme/use-theme';
import { Radius, Spacing } from '@/theme/tokens';

function currencyName(code: string): string {
  try {
    const name = new Intl.DisplayNames(currentLanguage(), { type: 'currency' }).of(code);
    return name && name !== code ? `${code} · ${name}` : code;
  } catch {
    return code;
  }
}

/** Kur çevirici: Avrupa Merkez Bankası kuru, saatlik önbellek. */
export default function CurrencyScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const device = getLocales()[0]?.currencyCode ?? 'USD';
  const [from, setFrom] = useState('EUR');
  const [to, setTo] = useState(CURRENCIES.includes(device) && device !== 'EUR' ? device : 'USD');
  const [amount, setAmount] = useState('100');
  const [rate, setRate] = useState<number | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getRate(from, to).then((r) => !cancelled && setRate(r));
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const value = Number(amount.replace(',', '.'));
  const result = rate && Number.isFinite(value) ? value * rate : null;
  const fmt = (n: number, code: string) => new Intl.NumberFormat(currentLanguage(), { style: 'currency', currency: code, maximumFractionDigits: 2 }).format(n);
  const options = CURRENCIES.map((c) => ({ value: c, label: currencyName(c) }));
  const swap = () => {
    setRate(undefined);
    setFrom(to);
    setTo(from);
  };

  return (
    <Screen>
      <ModalHeader title={t('currency.title')} subtitle={t('currency.subtitle')} />
      <TextField label={t('currency.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <SelectSheet label={t('currency.from')} value={from} options={options} placeholder={from} onChange={(c) => { setRate(undefined); setFrom(c); }} />
      <Pressable accessibilityRole="button" accessibilityLabel={t('currency.swap')} onPress={swap} style={[styles.swap, { backgroundColor: colors.surfaceMuted }]}>
        <Ionicons name="swap-vertical" size={20} color={colors.primary} />
      </Pressable>
      <SelectSheet label={t('currency.to')} value={to} options={options} placeholder={to} onChange={(c) => { setRate(undefined); setTo(c); }} />

      <View style={[styles.result, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {rate === undefined ? (
          <ActivityIndicator color={colors.primary} />
        ) : result === null ? (
          <Text variant="body" color="warning">
            {t('currency.unavailable')}
          </Text>
        ) : (
          <>
            <Text variant="display">{fmt(result, to)}</Text>
            <Text variant="caption" color="textSecondary">
              1 {from} = {(rate ?? 0).toLocaleString(currentLanguage(), { maximumFractionDigits: 4 })} {to}
            </Text>
          </>
        )}
      </View>
      <Text variant="caption" color="textMuted">
        {t('currency.source')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  swap: { alignSelf: 'center', width: 44, height: 44, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center' },
  result: { padding: Spacing.xl, borderRadius: Radius.xl, borderWidth: 1, alignItems: 'center', gap: Spacing.xs },
});
