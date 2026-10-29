import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { ModalHeader } from '@/components/ui/modal-header';
import { Screen } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/section-header';
import { SelectSheet } from '@/components/ui/select-sheet';
import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { DateField } from '@/components/ui/date-field';
import { TextField } from '@/components/ui/text-field';
import { useCountryOptions } from '@/features/identity/country-options';
import { flag } from '@/features/tools/emergency-numbers';
import {
  documentWarning,
  useDeleteDocument,
  useDeleteStay,
  useDocuments,
  useSaveDocument,
  useSaveStay,
  useSchengenStays,
  type DocKind,
} from '@/features/travel/api';
import { requestReminderPermission } from '@/features/travel/reminders';
import { formatDayShort } from '@/lib/format';
import { useSessionStore } from '@/stores/session-store';
import { Gradients, Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { daysLeft, daysUsed, firstOverstay, LIMIT, maxStayFrom, nextDayFreed } from '../../../supabase/functions/_shared/schengen.ts';

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const KINDS: { key: DocKind; icon: ComponentProps<typeof Ionicons>['name'] }[] = [
  { key: 'passport', icon: 'book' },
  { key: 'visa', icon: 'pricetag' },
  { key: 'residence', icon: 'home' },
  { key: 'id_card', icon: 'card' },
  { key: 'other', icon: 'document' },
];
const today = () => new Date().toISOString().slice(0, 10);
const daysUntil = (iso: string) => Math.floor((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86_400_000);

/** Belgelerim (son kullanma hatırlatmaları) ve Schengen 90/180 hesaplayıcı. */
export default function MyDocsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const signedIn = useSessionStore((s) => Boolean(s.session));
  const passport = useSessionStore((s) => s.identity.passport);
  const countries = useCountryOptions();
  const { data: docs = [] } = useDocuments();
  const { data: stays = [] } = useSchengenStays();
  const saveDoc = useSaveDocument();
  const deleteDoc = useDeleteDocument();
  const saveStay = useSaveStay();
  const deleteStay = useDeleteStay();

  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<DocKind>('passport');
  const [country, setCountry] = useState<string | null>(passport);
  const [label, setLabel] = useState('');
  const [expires, setExpires] = useState('');
  const [entry, setEntry] = useState('');
  const [exit, setExit] = useState('');
  const [planEntry, setPlanEntry] = useState('');

  const now = today();
  const used = daysUsed(stays, now);
  const left = daysLeft(stays, now);
  const freed = nextDayFreed(stays, now);
  const overstay = firstOverstay(stays);
  const plan = DATE.test(planEntry) ? maxStayFrom(stays, planEntry) : null;

  if (!signedIn) {
    return (
      <Screen>
        <ModalHeader title={t('docs.title')} subtitle={t('docs.subtitle')} />
        <Card>
          <Text variant="body">{t('docs.needAccount')}</Text>
          <Button title={t('profile.createAccount')} variant="secondary" onPress={() => router.push('/sign-in')} />
        </Card>
      </Screen>
    );
  }

  async function addDoc() {
    await saveDoc.mutateAsync({ kind, country_code: country, label: label.trim() || null, expires_on: expires });
    setAdding(false);
    setLabel('');
    setExpires('');
    // İlk belgede bildirim izni istenir; hatırlatmalar liste yenilenince kurulur.
    await requestReminderPermission().catch(() => false);
  }

  return (
    <Screen>
      <ModalHeader title={t('docs.title')} subtitle={t('docs.subtitle')} />

      <View style={styles.section}>
        <SectionHeader title={t('docs.documents')} action={adding ? undefined : t('docs.add')} onAction={() => setAdding(true)} />
        {docs.length === 0 && !adding && (
          <Card>
            <Text variant="body" color="textSecondary">
              {t('docs.empty')}
            </Text>
            <Button title={t('docs.add')} icon="add" variant="secondary" onPress={() => setAdding(true)} />
          </Card>
        )}
        {docs.map((d) => {
          const warn = documentWarning(d);
          const days = daysUntil(d.expires_on);
          const icon = KINDS.find((k) => k.key === d.kind)?.icon ?? 'document';
          return (
            <Card key={d.id} padding={Spacing.md}>
              <View style={styles.row}>
                <View style={[styles.docIcon, { backgroundColor: colors.surfaceMuted }]}>
                  <Ionicons name={icon} size={20} color={warn === 'expired' ? colors.danger : warn === 'soon' ? colors.warning : colors.primary} />
                </View>
                <View style={styles.flex}>
                  <Text variant="bodyStrong" numberOfLines={1}>
                    {d.country_code ? `${flag(d.country_code)} ` : ''}
                    {d.label || t(`docs.kind.${d.kind}`)}
                  </Text>
                  <Text variant="caption" color={warn === 'expired' ? 'danger' : warn === 'soon' ? 'warning' : 'textSecondary'}>
                    {warn === 'expired' ? t('docs.expired', { date: formatDayShort(d.expires_on) }) : t('docs.expiresIn', { count: days, date: formatDayShort(d.expires_on) })}
                  </Text>
                  {warn === 'soon' && (d.kind === 'passport' || d.kind === 'id_card') && (
                    <Text variant="caption" color="textMuted">
                      {t('docs.passportRule')}
                    </Text>
                  )}
                </View>
                <Tap accessibilityRole="button" accessibilityLabel={t('city.remove')} onPress={() => deleteDoc.mutate(d.id)} hitSlop={8} feedback="select">
                  <Ionicons name="trash-outline" size={20} color={colors.textMuted} />
                </Tap>
              </View>
            </Card>
          );
        })}
        {adding && (
          <Card>
            <View style={styles.chips}>
              {KINDS.map((k) => (
                <Chip key={k.key} icon={k.icon} label={t(`docs.kind.${k.key}`)} selected={kind === k.key} onPress={() => setKind(k.key)} />
              ))}
            </View>
            <SelectSheet label={t('docs.country')} value={country} options={countries} placeholder={t('docs.country')} onChange={setCountry} />
            <TextField label={t('docs.label')} value={label} onChangeText={(v) => setLabel(v.slice(0, 60))} placeholder={t('docs.labelPlaceholder')} />
            <DateField label={t('docs.expiresOn')} value={expires} onChange={setExpires} />
            <Text variant="caption" color="textMuted">
              {t('docs.privacyNote')}
            </Text>
            <Button title={t('common.save')} disabled={!DATE.test(expires)} loading={saveDoc.isPending} onPress={addDoc} />
            <Button title={t('common.cancel')} variant="ghost" onPress={() => setAdding(false)} />
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title={t('docs.schengenTitle')} />
        <LinearGradient colors={overstay ? Gradients.danger : Gradients.accent} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <Text variant="overline" style={styles.soft}>
            {t('docs.schengenToday')}
          </Text>
          <View style={styles.bigRow}>
            <Text variant="hero" style={styles.white}>
              {left}
            </Text>
            <Text variant="body" style={[styles.soft, styles.bigLabel]}>
              {t('docs.daysLeft', { limit: LIMIT })}
            </Text>
          </View>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.min((used / LIMIT) * 100, 100)}%` }]} />
          </View>
          <Text variant="caption" style={styles.soft}>
            {t('docs.daysUsed', { used })}
            {freed && used > 0 ? ` · ${t('docs.freedFrom', { date: formatDayShort(freed) })}` : ''}
          </Text>
          {overstay && (
            <Text variant="bodyStrong" style={styles.white}>
              {t('docs.overstay', { date: formatDayShort(overstay) })}
            </Text>
          )}
        </LinearGradient>

        <Card>
          <Text variant="subtitle">{t('docs.planTitle')}</Text>
          <DateField label={t('docs.planEntry')} value={planEntry} onChange={setPlanEntry} />
          {plan && (
            <Text variant="bodyStrong" color={plan.days ? 'success' : 'danger'}>
              {plan.days ? t('docs.planResult', { count: plan.days, date: formatDayShort(plan.lastDay!) }) : t('docs.planNone')}
            </Text>
          )}
        </Card>

        <Card>
          <Text variant="subtitle">{t('docs.staysTitle')}</Text>
          {stays.map((s) => (
            <View key={s.id} style={styles.row}>
              <Ionicons name="airplane" size={16} color={colors.textSecondary} />
              <Text variant="body" style={styles.flex}>
                {formatDayShort(s.entry_on)} → {formatDayShort(s.exit_on)}
              </Text>
              <Tap accessibilityRole="button" accessibilityLabel={t('city.remove')} onPress={() => deleteStay.mutate(s.id)} hitSlop={8} feedback="select">
                <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
              </Tap>
            </View>
          ))}
          <View style={styles.row}>
            <View style={styles.flex}>
              <DateField label={t('docs.entry')} value={entry} onChange={setEntry} />
            </View>
            <View style={styles.flex}>
              <DateField label={t('docs.exit')} value={exit} min={entry || null} onChange={setExit} />
            </View>
          </View>
          <Button
            title={t('docs.addStay')}
            icon="add"
            variant="secondary"
            disabled={!DATE.test(entry) || !DATE.test(exit) || exit < entry}
            loading={saveStay.isPending}
            onPress={() => saveStay.mutate({ entry_on: entry, exit_on: exit, note: null }, { onSuccess: () => (setEntry(''), setExit('')) })}
          />
          <Text variant="caption" color="textMuted">
            {t('docs.schengenNote')}
          </Text>
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: Spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  docIcon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  hero: { borderRadius: Radius.xl, padding: Spacing.lg, gap: Spacing.sm },
  white: { color: '#FFFFFF' },
  soft: { color: 'rgba(255,255,255,0.88)' },
  bigRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
  bigLabel: { marginBottom: 6, flexShrink: 1 },
  track: { height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4, backgroundColor: '#FFFFFF' },
});
