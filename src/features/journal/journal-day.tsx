import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { formatDayShort } from '@/lib/format';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { uploadJournalPhoto, usePhotoUrls, useSaveJournalEntry } from './api';
import { JOURNAL_MOODS, MAX_NOTE, MAX_PHOTOS, MOOD_ICONS, type JournalEntry, type JournalMood } from './logic';

/** Tek günün günlüğü: not, ruh hali ve en fazla 4 fotoğraf. Kişiseldir; yalnızca yazan görür. */
export function JournalDay({ tripId, date, entry }: { tripId: string; date: string; entry: JournalEntry | undefined }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  const save = useSaveJournalEntry();
  const [note, setNote] = useState(entry?.note ?? '');
  const [mood, setMood] = useState<JournalMood | null>(entry?.mood ?? null);
  const [photos, setPhotos] = useState<string[]>(entry?.photos ?? []);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const { data: urls } = usePhotoUrls(photos);

  const dirty = note !== (entry?.note ?? '') || mood !== (entry?.mood ?? null) || photos.join('|') !== (entry?.photos ?? []).join('|');

  async function addPhoto() {
    if (!userId || photos.length >= MAX_PHOTOS) return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.9, allowsMultipleSelection: true, selectionLimit: MAX_PHOTOS - photos.length });
    if (result.canceled) return;
    setUploading(true);
    setFailed(false);
    try {
      const added: string[] = [];
      for (const asset of result.assets.slice(0, MAX_PHOTOS - photos.length)) added.push(await uploadJournalPhoto(asset.uri, userId, tripId));
      setPhotos((p) => [...p, ...added].slice(0, MAX_PHOTOS));
      setSaved(false);
    } catch {
      setFailed(true);
    } finally {
      setUploading(false);
    }
  }

  function submit() {
    setFailed(false);
    save.mutate(
      { tripId, date, note, mood, photos, previousPhotos: entry?.photos },
      { onSuccess: () => setSaved(true), onError: () => setFailed(true) },
    );
  }

  return (
    <View style={[styles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text variant="subtitle">{formatDayShort(date)}</Text>
      <View style={styles.moods} accessibilityRole="radiogroup">
        {JOURNAL_MOODS.map((m) => (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ selected: mood === m }}
            accessibilityLabel={t(`journal.moods.${m}` as 'journal.moods.good')}
            onPress={() => {
              setMood(mood === m ? null : m);
              setSaved(false);
            }}
            style={[styles.mood, { borderColor: mood === m ? colors.primary : colors.border, backgroundColor: mood === m ? colors.primary + '22' : 'transparent' }]}>
            <Ionicons name={MOOD_ICONS[m]} size={22} color={mood === m ? colors.primary : colors.textSecondary} />
          </Pressable>
        ))}
      </View>
      <TextInput
        value={note}
        onChangeText={(v) => {
          setNote(v);
          setSaved(false);
        }}
        multiline
        maxLength={MAX_NOTE}
        placeholder={t('journal.placeholder')}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={t('journal.placeholder')}
        style={[Typography.body, styles.input, { color: colors.text, borderColor: colors.border }]}
      />
      <View style={styles.photos}>
        {photos.map((p) => (
          <View key={p} style={[styles.photo, { backgroundColor: colors.border }]}>
            {urls?.get(p) ? <Image source={{ uri: urls.get(p) }} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityLabel={t('journal.photo')} /> : null}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('journal.removePhoto')}
              hitSlop={6}
              onPress={() => {
                setPhotos((list) => list.filter((x) => x !== p));
                setSaved(false);
              }}
              style={styles.remove}>
              <Ionicons name="close" size={14} color="#fff" />
            </Pressable>
          </View>
        ))}
        {photos.length < MAX_PHOTOS && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('journal.addPhoto')}
            disabled={uploading}
            onPress={addPhoto}
            style={[styles.photo, styles.add, { borderColor: colors.border }]}>
            {uploading ? <ActivityIndicator /> : <Ionicons name="camera-outline" size={24} color={colors.textSecondary} />}
          </Pressable>
        )}
      </View>
      {failed && (
        <Text variant="caption" color="danger">
          {t('common.error')}
        </Text>
      )}
      {saved && !dirty ? (
        <Text variant="caption" color="success">
          {t('journal.saved')}
        </Text>
      ) : null}
      <Button title={t('journal.save')} variant={dirty ? 'primary' : 'secondary'} disabled={!dirty || uploading} loading={save.isPending} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: Spacing.md, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1 },
  moods: { flexDirection: 'row', gap: Spacing.sm },
  mood: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 90, padding: Spacing.md, borderRadius: Radius.md, borderWidth: 1, textAlignVertical: 'top' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  photo: { width: 72, height: 72, borderRadius: Radius.md, overflow: 'hidden' },
  add: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderStyle: 'dashed', backgroundColor: 'transparent' },
  remove: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
});
