import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { DirIcon } from '@/components/ui/dir-icon';
import { EmptyState } from '@/components/ui/empty-state';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { ACCESS_ICON, ACCESS_TONE } from '@/features/identity/access-badge';
import { VISA_FLAG } from '@/features/identity/extra-visas';
import { IdentityForm } from '@/features/identity/identity-form';
import { PassportCard } from '@/features/identity/passport-card';
import { usePassportPower } from '@/features/identity/use-passport-power';
import { saveIdentityToProfile } from '@/features/profile/save-preferences';
import { flag } from '@/features/tools/emergency-numbers';
import { localCountryName } from '@/features/tools/countries';
import { useSessionStore, type TravelIdentity } from '@/stores/session-store';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { ALL_DESTINATIONS, bestAccess, type AccessStatus } from '../../../supabase/functions/_shared/visa-access.ts';

type Filter = 'easy' | 'evisa' | 'visa_required';
const FILTER_OF: Record<AccessStatus, Filter | null> = { own: null, visa_free: 'easy', visa_on_arrival: 'easy', eta: 'easy', evisa: 'evisa', visa_required: 'visa_required', no_admission: 'visa_required' };

/** Pasaportum: pasaport gücü, vatandaşlık ve vizeleri düzenleme, nereye gidebilirim listesi. */
export default function PassportScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const stored = useSessionStore((s) => s.identity);
  const setIdentity = useSessionStore((s) => s.setIdentity);
  const [editing, setEditing] = useState(!stored.passport);
  const [draft, setDraft] = useState<TravelIdentity>(stored);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<Filter>('easy');
  const [query, setQuery] = useState('');
  const identity = editing ? draft : stored;
  const power = usePassportPower(identity);
  const passports = useMemo(() => [identity.passport, ...identity.otherPassports].filter((p): p is string => !!p), [identity.passport, identity.otherPassports]);

  const rows = useMemo(() => {
    const q = query.trim().toLocaleLowerCase(i18n.language);
    return ALL_DESTINATIONS.filter((d) => !passports.includes(d))
      .map((d) => ({ code: d, name: localCountryName(d, i18n.language), access: bestAccess(passports, identity.extraVisas, d) }))
      .filter((r) => r.access && FILTER_OF[r.access.status] === filter && (!q || r.name.toLocaleLowerCase(i18n.language).includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name, i18n.language));
  }, [passports, identity.extraVisas, filter, query, i18n.language]);

  async function save() {
    setSaving(true);
    setIdentity(draft);
    const { session } = useSessionStore.getState();
    if (session) await saveIdentityToProfile(session.user.id, draft).catch((e) => console.warn('Profil kaydedilemedi', e));
    setSaving(false);
    setEditing(false);
  }

  return (
    <Screen>
      <ModalHeader title={t('passport.title')} subtitle={t('passport.subtitle')} />

      {editing ? (
        <>
          <IdentityForm value={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} />
          <Button title={t('common.save')} loading={saving} disabled={!draft.passport} onPress={save} />
          {stored.passport && <Button title={t('common.cancel')} variant="ghost" onPress={() => (setDraft(stored), setEditing(false))} />}
        </>
      ) : (
        <>
          {power && <PassportCard passports={passports} power={power} />}
          <Card>
            <View style={styles.summaryRow}>
              <View style={styles.flex}>
                <Text variant="overline" color="textMuted">
                  {t('identity.extraVisas')}
                </Text>
                <Text variant="body">
                  {identity.extraVisas.length ? identity.extraVisas.map((k) => `${VISA_FLAG[k] ?? ''} ${t(`visaType.${k}` as 'visaType.us_visa')}`).join(' · ') : t('passport.noExtraVisas')}
                </Text>
                {identity.homeCity && (
                  <Text variant="caption" color="textSecondary">
                    {t('passport.livesIn', { city: identity.homeCity })}
                  </Text>
                )}
              </View>
              <Button title={t('passport.edit')} variant="secondary" size="sm" icon="create-outline" onPress={() => (setDraft(stored), setEditing(true))} />
            </View>
          </Card>

          <Text variant="title">{t('passport.whereTitle')}</Text>
          <View style={styles.chips}>
            {(['easy', 'evisa', 'visa_required'] as const).map((f) => (
              <Chip key={f} label={t(`passport.filter.${f}`)} selected={filter === f} onPress={() => setFilter(f)} />
            ))}
          </View>
          <View style={[styles.search, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={t('common.search')}
              placeholderTextColor={colors.textMuted}
              accessibilityLabel={t('common.search')}
              style={[Typography.body, styles.flex, { color: colors.text }]}
            />
          </View>
          {rows.length === 0 ? (
            <EmptyState icon="earth-outline" title={t('passport.emptyTitle')} description={t('passport.emptyBody')} />
          ) : (
            <Card padding={Spacing.xs}>
              {rows.map((r) => (
                <Tap key={r.code} accessibilityRole="button" onPress={() => router.push({ pathname: '/visa', params: { destination: r.code } })} feedback="select" scaleTo={0.99}>
                  <View style={styles.row}>
                    <Text style={styles.flag}>{flag(r.code)}</Text>
                    <View style={styles.flex}>
                      <Text variant="bodyStrong" numberOfLines={1}>
                        {r.name}
                      </Text>
                      <Text variant="caption" color={ACCESS_TONE[r.access!.status]}>
                        {t(`access.${r.access!.status}`)}
                        {r.access!.days ? ` · ${t('access.days', { count: r.access!.days })}` : ''}
                        {r.access!.via.kind === 'visa' ? ` · ${VISA_FLAG[r.access!.via.key] ?? ''} ${t('access.withVisa')}` : ''}
                      </Text>
                    </View>
                    <Ionicons name={ACCESS_ICON[r.access!.status]} size={18} color={colors[ACCESS_TONE[r.access!.status]]} />
                    <DirIcon name="chevron-forward" size={16} color={colors.textMuted} />
                  </View>
                </Tap>
              ))}
            </Card>
          )}
          <Text variant="caption" color="textMuted">
            {t('identity.disclaimer')}
          </Text>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md, height: 46, borderRadius: Radius.md, borderWidth: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  flag: { fontSize: 24 },
});
