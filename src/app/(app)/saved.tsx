import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { useMarkVisited, useRemoveSaved, useSavedPlaces, useVisits, type SavedPlace } from '@/features/city/api';
import { openInMaps } from '@/features/places/api';
import { useCurrentPlan } from '@/features/subscription/purchases';
import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const DEFAULT_LIST = 'want';

function SavedRow({ p, visited, onVisit, onRemove }: { p: SavedPlace; visited: boolean; onVisit: () => void; onRemove: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Tap accessibilityRole="link" onPress={() => openInMaps({ name: p.name, mapsUrl: p.maps_url, placeId: p.google_place_id, lat: p.lat, lng: p.lng })} style={styles.flex} feedback="select">
        <View style={styles.rowText}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {visited ? '✓ ' : ''}
            {p.name}
          </Text>
          {p.address && (
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {p.address}
            </Text>
          )}
        </View>
      </Tap>
      <Tap accessibilityRole="button" accessibilityLabel={t('city.visited')} onPress={onVisit} hitSlop={8} feedback="select">
        <Ionicons name={visited ? 'checkmark-circle' : 'checkmark-circle-outline'} size={24} color={visited ? colors.success : colors.textSecondary} />
      </Tap>
      <Tap accessibilityRole="button" accessibilityLabel={t('city.remove')} onPress={onRemove} hitSlop={8} feedback="select">
        <Ionicons name="trash-outline" size={22} color={colors.textMuted} />
      </Tap>
    </View>
  );
}

/** Gitmek istediklerim: kayıtlı yerler; Pro'da birden fazla liste. */
export default function SavedScreen() {
  const { t } = useTranslation();
  const { data: places = [], isLoading } = useSavedPlaces();
  const { data: visits = [] } = useVisits();
  const { data: plan } = useCurrentPlan();
  const isPro = plan === 'pro_monthly' || plan === 'pro_yearly';
  const remove = useRemoveSaved();
  const visit = useMarkVisited();
  const [list, setList] = useState(DEFAULT_LIST);
  const [newList, setNewList] = useState<string | null>(null);
  const lists = useMemo(() => [...new Set([DEFAULT_LIST, ...places.map((p) => p.list_name), ...(newList?.trim() ? [newList.trim()] : [])])], [places, newList]);
  const visited = useMemo(() => new Set(visits.map((v) => v.google_place_id)), [visits]);
  const shown = places.filter((p) => p.list_name === list);
  const listLabel = (name: string) => (name === DEFAULT_LIST ? t('city.wantList') : name);

  return (
    <Screen>
      <ModalHeader title={t('city.savedTitle')} subtitle={t('city.savedSubtitle')} />
      <View style={styles.chips}>
        {lists.map((l) => (
          <Chip key={l} label={listLabel(l)} selected={list === l} onPress={() => setList(l)} />
        ))}
        <Chip icon={isPro ? 'add' : 'diamond-outline'} label={t('city.newList')} onPress={() => (isPro ? setNewList('') : router.push({ pathname: '/paywall', params: { reason: 'quota' } }))} />
      </View>
      {newList !== null && (
        <Card>
          <TextField label={t('city.listName')} value={newList} onChangeText={(v) => setNewList(v.slice(0, 40))} placeholder={t('city.listPlaceholder')} />
          <Button
            title={t('common.save')}
            size="sm"
            disabled={!newList.trim()}
            onPress={() => {
              setList(newList.trim());
              setNewList(null);
            }}
          />
          <Text variant="caption" color="textMuted">
            {t('city.newListHint')}
          </Text>
        </Card>
      )}
      {!isLoading && shown.length === 0 ? (
        <EmptyState icon="bookmark-outline" title={t('city.savedEmptyTitle')} description={t('city.savedEmptyBody')}>
          <Button title={t('decide.title')} variant="secondary" icon="dice" onPress={() => router.push('/decide')} />
        </EmptyState>
      ) : (
        <Card padding={Spacing.xs}>
          {shown.map((p) => (
            <SavedRow key={p.id} p={p} visited={visited.has(p.google_place_id)} onVisit={() => visit.mutate(p)} onRemove={() => remove.mutate(p.id)} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  rowText: { gap: 2 },
});
