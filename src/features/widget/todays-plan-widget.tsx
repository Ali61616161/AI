import { HStack, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, frame, lineLimit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

import type { TodaysPlanWidgetProps } from './types';

/**
 * iOS ana ekran widget'ı. 'widget' yönergesiyle işaretli fonksiyon metne çevrilip widget
 * eklentisinde çalıştırılır: dış değişken, i18next veya yardımcı fonksiyon kullanamaz.
 * Renkler src/theme/tokens.ts koyu temasından (deep zemin, mercan/turkuaz vurgular).
 */
function TodaysPlanWidget(props: TodaysPlanWidgetProps, env: WidgetEnvironment) {
  'widget';
  const small = env.widgetFamily === 'systemSmall';
  const items = (props.items ?? []).slice(0, small ? 2 : 3);
  return (
    <VStack
      alignment="leading"
      spacing={small ? 4 : 6}
      modifiers={[
        frame({ maxWidth: 10000, maxHeight: 10000, alignment: 'topLeading' }),
        containerBackground('#070B16', 'widget'),
        widgetURL(props.url || 'yola://'),
      ]}>
      <Text modifiers={[font({ size: 11, weight: 'semibold' }), foregroundStyle('#FF6B4A'), lineLimit(1)]}>
        {props.heading}
      </Text>
      {props.city ? (
        <HStack spacing={6} alignment="firstTextBaseline">
          <Text modifiers={[font({ size: small ? 16 : 18, weight: 'bold' }), foregroundStyle('#F4F6FB'), lineLimit(1)]}>
            {props.city}
          </Text>
          {small ? null : <Spacer />}
          {small ? null : (
            <Text modifiers={[font({ size: 12, weight: 'medium' }), foregroundStyle('#2EE6C9'), lineLimit(1)]}>
              {props.subtitle}
            </Text>
          )}
        </HStack>
      ) : null}
      {props.city && small ? (
        <Text modifiers={[font({ size: 11, weight: 'medium' }), foregroundStyle('#2EE6C9'), lineLimit(1)]}>{props.subtitle}</Text>
      ) : null}
      {items.length > 0 ? (
        <VStack alignment="leading" spacing={small ? 3 : 4} modifiers={[padding({ top: 2 })]}>
          {items.map((item, index) => (
            <HStack key={String(index)} spacing={6} alignment="firstTextBaseline">
              {item.time ? (
                <Text
                  modifiers={[
                    font({ size: small ? 11 : 12, weight: 'semibold', design: 'rounded' }),
                    foregroundStyle('#FF8A5C'),
                    lineLimit(1),
                  ]}>
                  {item.time}
                </Text>
              ) : null}
              <Text modifiers={[font({ size: small ? 12 : 13 }), foregroundStyle('#E7EAF3'), lineLimit(1)]}>{item.title}</Text>
            </HStack>
          ))}
        </VStack>
      ) : (
        <Text modifiers={[font({ size: small ? 12 : 13 }), foregroundStyle('rgba(255,255,255,0.72)'), lineLimit(small ? 4 : 3)]}>
          {props.emptyText}
        </Text>
      )}
      <Spacer />
    </VStack>
  );
}

/** Ad, app.config.ts içindeki expo-widgets eklentisindeki "name" ile aynı olmalı. */
export const todaysPlanWidget = createWidget<TodaysPlanWidgetProps>('TodaysPlan', TodaysPlanWidget);
