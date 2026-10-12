import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRewardedAd } from 'react-native-google-mobile-ads';
import { useTranslation } from 'react-i18next';

import { Tap } from '@/components/ui/tap';
import { Text } from '@/components/ui/text';
import { haptic } from '@/lib/haptics';
import { getSupabase } from '@/lib/supabase';
import { useSessionStore } from '@/stores/session-store';
import { Radius, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { AD_UNITS, type RewardableFeature } from './config';
import { useShowAds } from './use-show-ads';

type Phase = 'idle' | 'verifying' | 'granted' | 'failed';

async function dailyLimit(feature: RewardableFeature): Promise<number | null> {
  const { data } = await getSupabase().rpc('quota_status', { p_feature: feature }).single<{ per_day: number | null }>();
  return data?.per_day ?? null;
}

/**
 * Günlük hak dolunca "Reklam izle, +1 hak". Hak, Google'ın sunucu doğrulaması
 * (ad-reward) ulaşınca verilir; düğme sunucuda limit artana kadar bekler.
 */
export function RewardedButton({ feature, onRewarded }: { feature: RewardableFeature; onRewarded?: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const show = useShowAds();
  const userId = useSessionStore((s) => s.session?.user.id ?? null);
  const enabled = show && userId !== null;
  const ad = useRewardedAd({
    adUnitId: enabled ? AD_UNITS.rewarded : null,
    requestOptions: { serverSideVerificationOptions: { userId: userId ?? undefined, customData: feature } },
    autoLoad: enabled,
  });
  const [phase, setPhase] = useState<Phase>('idle');
  const before = useRef<number | null>(null);
  const handled = useRef(false);

  // Reklam sonuna kadar izlenince sunucunun ödülü işlemesini bekle (en fazla ~10 sn).
  useEffect(() => {
    if (!ad.earnedReward || handled.current) return;
    handled.current = true;
    (async () => {
      await Promise.resolve();
      setPhase('verifying');
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const now = await dailyLimit(feature).catch(() => null);
        if (now !== null && before.current !== null && now > before.current) {
          setPhase('granted');
          haptic.success();
          await queryClient.invalidateQueries();
          onRewarded?.();
          return;
        }
      }
      setPhase('failed');
    })();
  }, [ad.earnedReward, feature, onRewarded, queryClient]);

  if (!enabled) return null;
  if (phase === 'granted') {
    return (
      <View style={styles.row}>
        <Ionicons name="checkmark-circle" size={18} color={colors.success} />
        <Text variant="caption" color="success">
          {t('ads.rewardGranted')}
        </Text>
      </View>
    );
  }
  if (phase === 'verifying') {
    return (
      <View style={styles.row}>
        <ActivityIndicator size="small" color={colors.accent} />
        <Text variant="caption" color="textSecondary">
          {t('ads.rewardPending')}
        </Text>
      </View>
    );
  }
  if (ad.status !== 'loaded') return null;

  return (
    <View style={styles.wrap}>
      <Tap
        accessibilityRole="button"
        feedback="press"
        onPress={async () => {
          before.current = await dailyLimit(feature).catch(() => null);
          handled.current = false;
          ad.show();
        }}>
        <View style={[styles.button, { borderColor: colors.accent, backgroundColor: `${colors.accent}1A` }]}>
          <Ionicons name="play-circle" size={18} color={colors.accent} />
          <Text variant="caption" color="accent">
            {t('ads.watchForCredit')}
          </Text>
        </View>
      </Tap>
      {phase === 'failed' && (
        <Text variant="caption" color="warning">
          {t('ads.rewardFailed')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.xs },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  button: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, alignSelf: 'flex-start', paddingHorizontal: Spacing.md, paddingVertical: 9, borderRadius: Radius.pill, borderWidth: 1 },
});
