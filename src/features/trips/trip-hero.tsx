import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/theme/tokens';

import { goBack } from '@/lib/go-back';

import { CityArt } from './city-art';

type Action = { icon: ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void };

/** Seyahat detayının üstü: şehir görseli, başlık, tarihler ve yuvarlak eylem düğmeleri. */
export function TripHero({ id, city, title, subtitle, actions = [], onMore }: { id: string; city: string; title: string; subtitle: string; actions?: Action[]; onMore?: () => void }) {
  const { t } = useTranslation();
  return (
    <View style={styles.hero}>
      <CityArt seed={city} id={`hero${id}`} />
      <View style={styles.top}>
        <Tap accessibilityRole="button" accessibilityLabel={t('common.close')} onPress={goBack} feedback="select" hitSlop={10}>
          <View style={styles.glassBtn}>
            <Ionicons name="chevron-down" size={20} color="#FFFFFF" />
          </View>
        </Tap>
        {onMore && (
          <Tap accessibilityRole="button" accessibilityLabel={t('trip.more')} onPress={onMore} feedback="select" hitSlop={10}>
            <View style={styles.glassBtn}>
              <Ionicons name="ellipsis-horizontal" size={20} color="#FFFFFF" />
            </View>
          </Tap>
        )}
      </View>
      <View style={styles.bottom}>
        <Text variant="hero" numberOfLines={2} style={styles.white}>
          {title}
        </Text>
        <Text variant="caption" style={styles.soft}>
          {subtitle}
        </Text>
        <View style={styles.actions}>
          {actions.map((a) => (
            <Tap key={a.label} accessibilityRole="button" accessibilityLabel={a.label} onPress={a.onPress} feedback="select" scaleTo={0.94}>
              <View style={styles.action}>
                <Ionicons name={a.icon} size={16} color="#FFFFFF" />
                <Text variant="caption" numberOfLines={1} style={styles.white}>
                  {a.label}
                </Text>
              </View>
            </Tap>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { minHeight: 250, borderRadius: Radius.xl, overflow: 'hidden', padding: Spacing.lg, justifyContent: 'space-between', gap: Spacing.lg },
  top: { flexDirection: 'row', justifyContent: 'space-between' },
  glassBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  bottom: { gap: Spacing.xs },
  white: { color: '#FFFFFF' },
  soft: { color: 'rgba(255,255,255,0.85)' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.md },
  action: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: Spacing.md, height: 36, borderRadius: Radius.pill, backgroundColor: 'rgba(0,0,0,0.25)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' },
});
