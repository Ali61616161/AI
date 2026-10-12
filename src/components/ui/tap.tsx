import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { haptic } from '@/lib/haptics';
import { Motion } from '@/theme/tokens';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  /** Basılıyken küçülme oranı. */
  scaleTo?: number;
  feedback?: 'tap' | 'select' | 'press' | 'none';
};

/** Dokununca yayla hafifçe küçülen ve titreşim veren dokunulabilir alan. */
export function Tap({ style, scaleTo = 0.97, feedback = 'tap', onPressIn, onPressOut, onPress, disabled, ...rest }: Props) {
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      disabled={disabled}
      onPressIn={(e) => {
        scale.set(withSpring(scaleTo, Motion.press));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.set(withSpring(1, Motion.press));
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (feedback !== 'none') haptic[feedback]();
        onPress?.(e);
      }}
      style={[style, animated, disabled ? { opacity: 0.45 } : null]}
      {...rest}
    />
  );
}
