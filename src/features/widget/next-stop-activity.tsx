import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, frame, lineLimit, padding } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

import type { NextStopActivityProps } from './types';

/**
 * Kilit ekranı / Dynamic Island "sıradaki durak". 'widget' yönergesiyle işaretli fonksiyon metne çevrilip
 * widget eklentisinde çalıştırılır: dış değişken, i18next veya yardımcı fonksiyon kullanamaz.
 * Geri sayım iOS'un kendi zamanlayıcısıdır: uygulama kapalıyken de akar.
 * Renkler src/theme/tokens.ts koyu temasından (mercan/turkuaz vurgular).
 */
function NextStopActivity(props: NextStopActivityProps) {
  'widget';
  const target = new Date(props.targetMs);
  return {
    banner: (
      <VStack alignment="leading" spacing={4} modifiers={[padding({ all: 12 })]}>
        <HStack spacing={8} alignment="firstTextBaseline">
          <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle('#FF6B4A'), lineLimit(1)]}>{props.heading}</Text>
          <Spacer />
          <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('rgba(255,255,255,0.72)'), lineLimit(1)]}>{props.countLabel}</Text>
        </HStack>
        <HStack spacing={8} alignment="firstTextBaseline">
          <Text modifiers={[font({ size: 18, weight: 'bold' }), foregroundStyle('#F4F6FB'), lineLimit(1)]}>{props.title}</Text>
          <Spacer />
          <Text date={target} dateStyle="timer" modifiers={[font({ size: 20, weight: 'semibold', design: 'rounded' }), foregroundStyle('#2EE6C9'), lineLimit(1), frame({ width: 84, alignment: 'trailing' })]} />
        </HStack>
        <Text modifiers={[font({ size: 12 }), foregroundStyle('rgba(255,255,255,0.72)'), lineLimit(1)]}>{props.detail}</Text>
      </VStack>
    ),
    compactLeading: <Image systemName="location.fill" size={14} color="#FF6B4A" />,
    compactTrailing: <Text date={target} dateStyle="timer" modifiers={[font({ size: 12, weight: 'semibold', design: 'rounded' }), foregroundStyle('#2EE6C9'), lineLimit(1), frame({ width: 52, alignment: 'trailing' })]} />,
    minimal: <Image systemName="location.fill" size={14} color="#FF6B4A" />,
    expandedLeading: (
      <VStack alignment="leading" spacing={2} modifiers={[padding({ all: 8 })]}>
        <Image systemName="location.fill" size={16} color="#FF6B4A" />
        <Text date={target} dateStyle="timer" modifiers={[font({ size: 16, weight: 'semibold', design: 'rounded' }), foregroundStyle('#2EE6C9'), lineLimit(1), frame({ width: 64, alignment: 'leading' })]} />
      </VStack>
    ),
    expandedCenter: (
      <VStack alignment="leading" spacing={2}>
        <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle('#FF6B4A'), lineLimit(1)]}>{props.heading + ' · ' + props.countLabel}</Text>
        <Text modifiers={[font({ size: 16, weight: 'bold' }), foregroundStyle('#F4F6FB'), lineLimit(2)]}>{props.title}</Text>
      </VStack>
    ),
    expandedBottom: <Text modifiers={[font({ size: 12 }), foregroundStyle('rgba(255,255,255,0.72)'), lineLimit(1)]}>{props.detail}</Text>,
  };
}

export const nextStopActivity = createLiveActivity<NextStopActivityProps>('NextStop', NextStopActivity);
