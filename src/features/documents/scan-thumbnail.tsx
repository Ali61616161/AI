import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

const SIZE = 56;

/** Belgenin küçük resmi; AI okurken üzerinde bir tarama çizgisi gezer. */
export function ScanThumbnail({ uri, mimeType, scanning }: { uri: string; mimeType: string; scanning: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (scanning && !reduceMotion) {
      progress.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else {
      cancelAnimation(progress);
      progress.value = 0;
    }
  }, [scanning, reduceMotion, progress]);

  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: progress.value * (SIZE - 3) }] }));

  return (
    <View style={[styles.box, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      {mimeType.startsWith('image/') ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <Ionicons name="document-text" size={26} color={colors.primary} />
      )}
      {scanning && (
        <>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primary, opacity: 0.12 }]} />
          <Animated.View style={[styles.line, { backgroundColor: colors.primary }, lineStyle]} />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: SIZE,
    height: SIZE,
    borderRadius: Radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  line: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
});
