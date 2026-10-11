import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { useOpenNow, type NearbyCategory, type Place } from '@/features/places/api';
import { PlaceMeta } from '@/features/places/place-row';
import { getCurrentLocation } from '@/features/plan/replan';
import { useSendInvite } from '@/features/social/api';
import { UpgradeButton } from '@/features/subscription/upgrade-button';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const CATEGORIES: NearbyCategory[] = ['cafe', 'museum', 'attraction', 'restaurant'];
const SLOTS = ['in1h', 'in2h', 'evening', 'tomorrow'] as const;

function slotTime(slot: (typeof SLOTS)[number]): Date {
  const d = new Date();
  if (slot === 'in1h') return new Date(d.getTime() + 60 * 60_000);
  if (slot === 'in2h') return new Date(d.getTime() + 120 * 60_000);
  if (slot === 'evening') {
    d.setHours(19, 0, 0, 0);
    return d.getTime() > Date.now() + 30 * 60_000 ? d : new Date(d.getTime() + 86_400_000);
  }
  d.setDate(d.getDate() + 1);
  d.setHours(11, 0, 0, 0);
  return d;
}

/** Buluşma daveti: sadece halka açık bir mekan ve saat seçilerek gönderilir. */
export default function InviteScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { userId, name } = useLocalSearchParams<{ userId: string; name?: string }>();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [category, setCategory] = useState<NearbyCategory>('cafe');
  const [place, setPlace] = useState<Place | null>(null);
  const [slot, setSlot] = useState<(typeof SLOTS)[number]>('in1h');
  const [message, setMessage] = useState('');
  const places = useOpenNow(category, coords);
  const send = useSendInvite();

  useEffect(() => {
    getCurrentLocation().then(setCoords);
  }, []);

  async function submit() {
    if (!place || place.lat === null || place.lng === null) return;
    await send.mutateAsync({ to: userId, placeId: place.id, placeName: place.name, lat: place.lat, lng: place.lng, meetAt: slotTime(slot), message });
    router.back();
  }

  const code = (send.error as { code?: string } | null)?.code;

  return (
    <Screen
      footer={<Button title={t('social.sendInvite')} disabled={!place} loading={send.isPending} onPress={submit} />}>
      <ModalHeader title={t('social.inviteTitle', { name: name || t('social.traveler') })} subtitle={t('social.invitePublicOnly')} />

      <Text variant="subtitle">{t('social.choosePlace')}</Text>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => (
          <Chip key={c} label={t(`nearby.categories.${c}`)} selected={c === category} onPress={() => setCategory(c)} />
        ))}
      </View>
      {!coords || places.isLoading ? (
        <ActivityIndicator />
      ) : (
        places.data?.slice(0, 6).map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: place?.id === p.id }}
            onPress={() => setPlace(p)}
            style={[styles.place, { backgroundColor: colors.surface, borderColor: place?.id === p.id ? colors.primary : colors.border, borderWidth: place?.id === p.id ? 2 : 1 }]}>
            <Text variant="bodyStrong">{p.name}</Text>
            <PlaceMeta rating={p.rating} ratingCount={p.ratingCount} priceLevel={p.priceLevel} distanceM={p.distanceM} />
          </Pressable>
        ))
      )}

      <Text variant="subtitle">{t('social.chooseTime')}</Text>
      <View style={styles.chips}>
        {SLOTS.map((s) => (
          <Chip key={s} label={t(`social.slots.${s}`)} selected={slot === s} onPress={() => setSlot(s)} />
        ))}
      </View>

      <TextInput
        value={message}
        onChangeText={setMessage}
        maxLength={280}
        multiline
        placeholder={t('social.messagePlaceholder')}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t('social.messagePlaceholder')}
        style={[Typography.body, styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      {code && (
        <Text variant="caption" color={code === 'quota_exceeded' ? 'warning' : 'danger'}>
          {t(`social.inviteErrors.${code as 'unknown'}`)}
        </Text>
      )}
      {code === 'quota_exceeded' && <UpgradeButton />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs },
  place: { gap: Spacing.xxs, padding: Spacing.md, borderRadius: Radius.lg },
  input: { minHeight: 70, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, textAlignVertical: 'top' },
});
