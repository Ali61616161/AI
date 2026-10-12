import { Image, StyleSheet, Text as RNText, View } from 'react-native';
import { NativeAdView, NativeAsset, NativeAssetType, NativeMediaView, useNativeAd } from 'react-native-google-mobile-ads';
import { useTranslation } from 'react-i18next';

import { GradientBg } from '@/components/ui/gradient-bg';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, Typography } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { AD_UNITS } from './config';
import { useShowAds } from './use-show-ads';

/**
 * Uygulamanın kart tasarımına uyan doğal görünümlü reklam. "Sponsorlu" etiketi her
 * zaman görünür. Sadece ücretsiz planda ve izinler alınmışsa yüklenir; reklam yoksa
 * hiç yer kaplamaz.
 */
export function NativeAdCard({ media = false }: { media?: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const show = useShowAds();
  const ad = useNativeAd({ adUnitId: show ? AD_UNITS.native : null, autoLoad: show });
  if (!show || ad.status !== 'loaded') return null;
  const nativeAd = ad.nativeAd;

  return (
    <NativeAdView nativeAd={nativeAd} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: colors.surfaceMuted }]}>
          <Text variant="overline" color="textMuted">
            {t('ads.sponsored')}
          </Text>
        </View>
        {nativeAd.advertiser && (
          <NativeAsset assetType={NativeAssetType.ADVERTISER}>
            <RNText numberOfLines={1} style={[Typography.caption, styles.flex, { color: colors.textMuted }]}>
              {nativeAd.advertiser}
            </RNText>
          </NativeAsset>
        )}
      </View>
      <View style={styles.row}>
        {nativeAd.icon && (
          <NativeAsset assetType={NativeAssetType.ICON}>
            <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
          </NativeAsset>
        )}
        <View style={styles.flex}>
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <RNText numberOfLines={2} style={[Typography.bodyStrong, { color: colors.text }]}>
              {nativeAd.headline}
            </RNText>
          </NativeAsset>
          {!!nativeAd.body && (
            <NativeAsset assetType={NativeAssetType.BODY}>
              <RNText numberOfLines={2} style={[Typography.caption, { color: colors.textSecondary }]}>
                {nativeAd.body}
              </RNText>
            </NativeAsset>
          )}
        </View>
      </View>
      {media && nativeAd.mediaContent && <NativeMediaView resizeMode="cover" style={styles.media} />}
      {!!nativeAd.callToAction && (
        <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
          <View style={styles.cta}>
            <GradientBg />
            <RNText style={[Typography.bodyStrong, styles.ctaText]}>{nativeAd.callToAction}</RNText>
          </View>
        </NativeAsset>
      )}
    </NativeAdView>
  );
}

const styles = StyleSheet.create({
  card: { padding: Spacing.lg, borderRadius: Radius.xl, borderWidth: StyleSheet.hairlineWidth * 2, gap: Spacing.md, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  badge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: Radius.pill },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1, gap: 2 },
  icon: { width: 48, height: 48, borderRadius: 14 },
  media: { width: '100%', borderRadius: Radius.lg, overflow: 'hidden' },
  cta: { height: 48, borderRadius: Radius.pill, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#FFFFFF' },
});
