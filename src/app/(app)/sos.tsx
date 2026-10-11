import Ionicons from '@expo/vector-icons/Ionicons';
import * as Localization from 'expo-localization';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { getCurrentLocation } from '@/features/plan/replan';
import { useContactsStore } from '@/features/tools/contacts-store';
import { countryName, emergencyNumbersFor, flag, type EmergencyNumbers } from '@/features/tools/emergency-numbers';
import { useTrip, useTrips } from '@/features/trips/queries';
import { todayIsoDate } from '@/lib/format';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const call = (number: string) => Linking.openURL(`tel:${number}`);

/** Acil durum: bulunduğun ülkenin numaraları, konum paylaşma, acil kişiler, otel adresi. */
export default function SosScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const { data: trips } = useTrips();
  const today = todayIsoDate();
  const current = trips?.find((x) => x.start_date && x.end_date && x.start_date <= today && x.end_date >= today) ?? trips?.find((x) => !x.end_date || x.end_date >= today);
  const { data: trip } = useTrip(current?.id);
  const country = trip?.trip_destinations[0]?.country_code ?? current?.trip_destinations[0]?.country_code ?? Localization.getLocales()[0]?.regionCode ?? null;
  const numbers = emergencyNumbersFor(country);
  const hotel = trip?.reservations.find((r) => r.type === 'hotel' && r.address && (!r.ends_at || r.ends_at.slice(0, 10) >= today));
  const { contacts, add, remove } = useContactsStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sharing, setSharing] = useState(false);

  async function locationMessage(): Promise<string> {
    const here = await getCurrentLocation();
    const lines = [t('sos.shareText')];
    if (here) lines.push(`https://www.google.com/maps/search/?api=1&query=${here.lat.toFixed(5)},${here.lng.toFixed(5)}`);
    if (hotel) lines.push(`${t('sos.hotel')}: ${hotel.title}, ${hotel.address}`);
    return lines.join('\n');
  }

  async function shareLocation() {
    setSharing(true);
    try {
      await Share.share({ message: await locationMessage() });
    } finally {
      setSharing(false);
    }
  }

  async function textContact(number: string) {
    const body = encodeURIComponent(await locationMessage());
    Linking.openURL(`sms:${number}?body=${body}`);
  }

  const rows: { key: keyof EmergencyNumbers; icon: 'call' | 'shield-outline' | 'medkit-outline' | 'flame-outline' | 'information-circle-outline' }[] = [
    { key: 'general', icon: 'call' },
    { key: 'police', icon: 'shield-outline' },
    { key: 'ambulance', icon: 'medkit-outline' },
    { key: 'fire', icon: 'flame-outline' },
    { key: 'tourist', icon: 'information-circle-outline' },
  ];

  return (
    <Screen>
      <ModalHeader title={t('sos.title')} subtitle={country ? `${flag(country)} ${countryName(country, i18n.language)}` : t('sos.subtitle')} />

      <View style={styles.grid}>
        {numbers ? (
          rows
            .filter((r) => numbers[r.key])
            .map((r) => (
              <Pressable
                key={r.key}
                accessibilityRole="button"
                accessibilityLabel={`${t(`sos.numbers.${r.key}`)} ${numbers[r.key]}`}
                onPress={() => call(numbers[r.key]!)}
                style={[styles.number, { backgroundColor: r.key === 'general' ? colors.danger : colors.surface, borderColor: colors.danger }]}>
                <Ionicons name={r.icon} size={22} color={r.key === 'general' ? colors.onPrimary : colors.danger} />
                <Text variant="title" style={{ color: r.key === 'general' ? colors.onPrimary : colors.text }}>
                  {numbers[r.key]}
                </Text>
                <Text variant="caption" style={{ color: r.key === 'general' ? colors.onPrimary : colors.textSecondary }}>
                  {t(`sos.numbers.${r.key}`)}
                </Text>
              </Pressable>
            ))
        ) : (
          <Pressable accessibilityRole="button" onPress={() => call('112')} style={[styles.number, { backgroundColor: colors.danger, borderColor: colors.danger }]}>
            <Ionicons name="call" size={22} color={colors.onPrimary} />
            <Text variant="title" style={{ color: colors.onPrimary }}>
              112
            </Text>
            <Text variant="caption" style={{ color: colors.onPrimary }}>
              {t('sos.unknownCountry')}
            </Text>
          </Pressable>
        )}
      </View>
      <Text variant="caption" color="textMuted">
        {t('sos.numbersNote')}
      </Text>

      <Button title={sharing ? t('common.loading') : t('sos.shareLocation')} loading={sharing} onPress={shareLocation} />

      {hotel && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text variant="caption" color="textSecondary">
            {t('sos.hotelForTaxi')}
          </Text>
          <Text variant="title">{hotel.title}</Text>
          <Text variant="body" selectable>
            {hotel.address}
          </Text>
        </View>
      )}

      <View style={styles.section}>
        <Text variant="subtitle">{t('sos.contacts')}</Text>
        {contacts.map((c) => (
          <View key={c.id} style={[styles.contact, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{c.name}</Text>
              <Text variant="caption" color="textSecondary">
                {c.phone}
              </Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={t('sos.call', { name: c.name })} onPress={() => call(c.phone)} style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="call-outline" size={18} color={colors.primary} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('sos.sendLocation', { name: c.name })} onPress={() => textContact(c.phone)} style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="location-outline" size={18} color={colors.primary} />
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={t('sos.remove', { name: c.name })} onPress={() => remove(c.id)} style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
              <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
            </Pressable>
          </View>
        ))}
        <View style={styles.addRow}>
          <TextInput value={name} onChangeText={setName} placeholder={t('sos.contactName')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('sos.contactName')} style={[Typography.body, styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
          <TextInput value={phone} onChangeText={setPhone} placeholder={t('sos.contactPhone')} keyboardType="phone-pad" placeholderTextColor={colors.textMuted} accessibilityLabel={t('sos.contactPhone')} style={[Typography.body, styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]} />
        </View>
        <Button
          title={t('sos.addContact')}
          variant="secondary"
          disabled={!name.trim() || phone.replace(/\D/g, '').length < 5}
          onPress={() => {
            add(name, phone);
            setName('');
            setPhone('');
          }}
        />
        <Text variant="caption" color="textMuted">
          {t('sos.contactsPrivacy')}
        </Text>
      </View>

      <Button title={t('phrases.title')} variant="ghost" onPress={() => router.push({ pathname: '/phrases', params: { country: country ?? '' } })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  number: { flexGrow: 1, flexBasis: '45%', alignItems: 'center', gap: Spacing.xxs, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1.5 },
  card: { gap: Spacing.xs, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  section: { gap: Spacing.md },
  contact: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  flex: { flex: 1 },
  icon: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  addRow: { gap: Spacing.sm },
  input: { padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
});
