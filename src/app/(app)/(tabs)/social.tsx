import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { getCurrentLocation } from '@/features/plan/replan';
import {
  LOOKING_FOR,
  SocialError,
  useGoVisible,
  useHide,
  useMyInvites,
  useNearbyTravelers,
  useRespondInvite,
  useSocialMe,
  type Invite,
  type SocialMe,
  type Traveler,
} from '@/features/social/api';
import { useTrips } from '@/features/trips/queries';
import { formatLocalDateTime, todayIsoDate } from '@/lib/format';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const SAFETY: { icon: ComponentProps<typeof Ionicons>['name']; key: 'safetyLocation' | 'safetyPublic' | 'safetyBlock' }[] = [
  { icon: 'locate-outline', key: 'safetyLocation' },
  { icon: 'cafe-outline', key: 'safetyPublic' },
  { icon: 'hand-left-outline', key: 'safetyBlock' },
];

function Setup({ me }: { me: SocialMe }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { data: trips } = useTrips();
  const goVisible = useGoVisible();
  const [name, setName] = useState(me.display_name ?? '');
  const [year, setYear] = useState(me.birth_year ? String(me.birth_year) : '');
  const [bio, setBio] = useState(me.bio ?? '');
  const [lookingFor, setLookingFor] = useState<string[]>(me.social?.looking_for.length ? me.social.looking_for : ['coffee']);
  const [accepted, setAccepted] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const today = todayIsoDate();
  const trip = trips?.find((x) => x.start_date && x.end_date && x.start_date <= today && x.end_date >= today);
  const birthYear = Number(year);
  // Güvenlik için doğum yılı bir kez belirlenince değiştirilemez.
  const yearLocked = me.birth_year != null;
  const valid = name.trim().length > 0 && Number.isInteger(birthYear) && birthYear > 1900 && accepted && lookingFor.length > 0;

  async function submit() {
    const location = await getCurrentLocation();
    setLocationDenied(!location);
    if (!location) return;
    goVisible.mutate({
      displayName: name,
      birthYear,
      bio,
      lookingFor,
      location,
      city: trip?.trip_destinations[0]?.city ?? null,
      countryCode: trip?.trip_destinations[0]?.country_code ?? null,
      until: trip?.end_date ?? null,
    });
  }

  const errorCode = goVisible.error instanceof SocialError ? goVisible.error.code : goVisible.error ? 'unknown' : null;

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="subtitle">{t('social.setupTitle')}</Text>
      <TextInput value={name} onChangeText={setName} maxLength={60} placeholder={t('social.displayName')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('social.displayName')} style={[Typography.body, styles.input, { color: colors.text, borderColor: colors.border }]} />
      <TextInput value={year} editable={!yearLocked} onChangeText={(v) => setYear(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" placeholder={t('social.birthYear')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('social.birthYear')} style={[Typography.body, styles.input, { color: colors.text, borderColor: colors.border }]} />
      <Text variant="caption" color="textMuted">
        {t('social.identityNote')}
      </Text>
      <TextInput value={bio} onChangeText={setBio} maxLength={300} multiline placeholder={t('social.bio')} placeholderTextColor={colors.textMuted} accessibilityLabel={t('social.bio')} style={[Typography.body, styles.input, styles.bio, { color: colors.text, borderColor: colors.border }]} />
      <Text variant="caption" color="textSecondary">
        {t('social.lookingFor')}
      </Text>
      <View style={styles.chips}>
        {LOOKING_FOR.map((l) => (
          <Chip key={l} label={t(`social.looking.${l}`)} selected={lookingFor.includes(l)} onPress={() => setLookingFor((x) => (x.includes(l) ? x.filter((y) => y !== l) : [...x, l]))} />
        ))}
      </View>
      <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted((v) => !v)} style={styles.switchRow}>
        <Ionicons name={accepted ? 'checkbox' : 'square-outline'} size={22} color={accepted ? colors.primary : colors.textSecondary} />
        <Text variant="caption" style={styles.flex}>
          {t('social.consent')}
        </Text>
      </Pressable>
      {locationDenied && (
        <Text variant="caption" color="warning">
          {t('nearby.locationDenied')}
        </Text>
      )}
      {errorCode && (
        <Text variant="caption" color="danger">
          {t(`social.errors.${errorCode}`)}
        </Text>
      )}
      <Button title={t('social.enable')} disabled={!valid} loading={goVisible.isPending} onPress={submit} />
    </View>
  );
}

function InviteRow({ invite }: { invite: Invite }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const respond = useRespondInvite();
  const when = formatLocalDateTime(invite.meet_at, null);
  const rowStyle = [styles.row, { backgroundColor: colors.surface, borderColor: invite.incoming && invite.status === 'pending' ? colors.primary : colors.border }];
  const content = (
    <>
      <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted }]}>
        <Text variant="bodyStrong">{(invite.other_name ?? '?')[0]?.toUpperCase()}</Text>
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">
          {invite.other_name ?? t('social.traveler')} {invite.other_verified ? '✓' : ''}
        </Text>
        <Text variant="caption" color="textSecondary">
          {invite.place_name} · {when}
        </Text>
        {invite.status === 'accepted' && invite.last_message && (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {invite.last_message}
          </Text>
        )}
        {invite.status === 'pending' && invite.incoming && (
          <View style={styles.chips}>
            <Chip icon="checkmark" label={t('social.accept')} onPress={() => respond.mutate({ id: invite.id, status: 'accepted' })} />
            <Chip icon="close" label={t('social.decline')} onPress={() => respond.mutate({ id: invite.id, status: 'declined' })} />
          </View>
        )}
        {invite.status === 'pending' && !invite.incoming && (
          <View style={styles.chips}>
            <Text variant="caption" color="textMuted">
              {t('social.waiting')}
            </Text>
            <Chip label={t('social.cancelInvite')} onPress={() => respond.mutate({ id: invite.id, status: 'cancelled' })} />
          </View>
        )}
        {(invite.status === 'declined' || invite.status === 'cancelled') && (
          <Text variant="caption" color="textMuted">
            {t(`social.status.${invite.status}`)}
          </Text>
        )}
      </View>
      {invite.status === 'accepted' && <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />}
    </>
  );
  // Kabul edilmiş davet sohbete açılır; diğerlerinde içteki düğmeler çalışsın diye kart dokunulabilir değildir.
  return invite.status === 'accepted' ? (
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/chat/[id]', params: { id: invite.id } })} style={rowStyle}>
      {content}
    </Pressable>
  ) : (
    <View style={rowStyle}>{content}</View>
  );
}

function TravelerRow({ traveler }: { traveler: Traveler }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
        <Text variant="bodyStrong">{(traveler.display_name ?? '?')[0]?.toUpperCase()}</Text>
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong">
          {traveler.display_name ?? t('social.traveler')} {traveler.is_verified ? '✓' : ''}
        </Text>
        <Text variant="caption" color="textSecondary">
          {t('social.distance', { km: traveler.distance_km < 1 ? '<1' : traveler.distance_km })}
          {traveler.looking_for.length ? ` · ${traveler.looking_for.map((l) => t(`social.looking.${l}` as 'social.looking.coffee')).join(', ')}` : ''}
        </Text>
        {traveler.bio && (
          <Text variant="caption" color="textMuted" numberOfLines={2}>
            {traveler.bio}
          </Text>
        )}
      </View>
      <Chip icon="cafe-outline" label={t('social.invite')} onPress={() => router.push({ pathname: '/invite', params: { userId: traveler.user_id, name: traveler.display_name ?? '' } })} />
    </View>
  );
}

/** Gezgin eşleşmesi: güvenlik kuralları, görünür olma, yakındaki gezginler, davetler. */
export default function SocialScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const session = useSessionStore((s) => s.session);
  const { data: me, isLoading } = useSocialMe();
  const visible = Boolean(me?.social?.is_visible);
  const travelers = useNearbyTravelers(visible);
  const { data: invites } = useMyInvites();
  const hide = useHide();
  const active = (invites ?? []).filter((i) => i.status === 'pending' || i.status === 'accepted');

  return (
    <Screen edges={['top']}>
      <View style={styles.header}>
        <Text variant="display">{t('social.title')}</Text>
        <Text variant="body" color="textSecondary">
          {t('social.subtitle')}
        </Text>
      </View>

      {!session || !isSupabaseConfigured() ? (
        <EmptyState icon="people-outline" title={t('social.title')} description={t('ticket.accountRequiredBody')} />
      ) : isLoading || !me ? (
        <ActivityIndicator />
      ) : (
        <>
          {!visible && (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text variant="subtitle">{t('social.safetyTitle')}</Text>
              {SAFETY.map((s) => (
                <View key={s.key} style={styles.safety}>
                  <Ionicons name={s.icon} size={22} color={colors.accent} />
                  <Text variant="body" style={styles.flex}>
                    {t(`social.${s.key}`)}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {active.length > 0 && (
            <View style={styles.section}>
              <Text variant="subtitle">{t('social.invites')}</Text>
              {active.map((i) => (
                <InviteRow key={i.id} invite={i} />
              ))}
            </View>
          )}

          {!visible ? (
            <Setup me={me} />
          ) : (
            <>
              <View style={[styles.visible, { backgroundColor: colors.surfaceMuted }]}>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
                <Text variant="body" style={styles.flex}>
                  {t('social.youAreVisible')}
                </Text>
                <Button title={t('social.hide')} variant="ghost" loading={hide.isPending} onPress={() => hide.mutate()} />
              </View>
              <View style={styles.section}>
                <Text variant="subtitle">{t('social.nearby')}</Text>
                {travelers.isLoading ? (
                  <ActivityIndicator />
                ) : travelers.data?.length ? (
                  travelers.data.map((x) => <TravelerRow key={x.user_id} traveler={x} />)
                ) : (
                  <Text variant="body" color="textMuted">
                    {t('social.nobody')}
                  </Text>
                )}
              </View>
            </>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: Spacing.sm },
  card: { gap: Spacing.md, padding: Spacing.xl, borderRadius: Radius.xl, borderWidth: 1 },
  safety: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  section: { gap: Spacing.sm },
  flex: { flex: 1 },
  input: { padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1 },
  bio: { minHeight: 70, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, alignItems: 'center' },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md, borderRadius: Radius.lg, borderWidth: 1 },
  avatar: { width: 44, height: 44, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  visible: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingLeft: Spacing.md, borderRadius: Radius.md },
  dot: { width: 10, height: 10, borderRadius: 5 },
});
