import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Keyboard, LayoutAnimation, Platform, ScrollView, StyleSheet, View, type KeyboardEvent } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useResetScrollOnTabEnter } from '@/lib/tab-scroll';
import { Spacing } from '@/theme/tokens';

import { Aurora } from './aurora';

type Props = {
  children: ReactNode;
  /** Alt kısımda sabit duran içerik (ör. "Devam" butonu). */
  footer?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  /** Sekme ekranlarında içerik yüzen alt menünün altında kalmasın diye boşluk. */
  tabBarSpace?: boolean;
  aurora?: 'default' | 'subtle';
  /** Sekme ekranının adı: başka bir sekmeden bu sekmeye geçilince içerik en üstten başlar. */
  tabName?: string;
};

export function Screen({ children, footer, scroll = true, edges = ['top', 'bottom'], tabBarSpace = false, aurora = 'default', tabName }: Props) {
  const scrollRef = useRef<ScrollView>(null);
  useResetScrollOnTabEnter(tabName, scrollRef);
  // Klavyenin ekrandaki gerçek konumuna göre alt boşluk: sayfa "sheet" olarak açıldığında (animasyonlu, ekranın
  // tepesinden başlamaz) sabit bir ofset yanlış kalıyordu; bu yüzden her klavye olayında kutunun pencere konumu ölçülür.
  const frame = useRef<View>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const apply = (inset: number, e?: KeyboardEvent) => {
      if (ios && e?.duration) LayoutAnimation.configureNext({ duration: e.duration, update: { type: LayoutAnimation.Types.keyboard } });
      setKeyboardInset((prev) => (Math.abs(prev - inset) > 1 ? inset : prev));
    };
    const onFrame = (e: KeyboardEvent) => {
      frame.current?.measureInWindow((_x, y, _w, h) => apply(Math.max(0, Math.round(y + h - e.endCoordinates.screenY)), e));
    };
    const subs = ios
      ? [Keyboard.addListener('keyboardWillChangeFrame', onFrame), Keyboard.addListener('keyboardWillHide', (e) => apply(0, e))]
      : [Keyboard.addListener('keyboardDidShow', onFrame), Keyboard.addListener('keyboardDidHide', () => apply(0))];
    return () => subs.forEach((sub) => sub.remove());
  }, []);
  const bottomSpace = tabBarSpace ? { paddingBottom: 120 } : null;
  const body = scroll ? (
    <ScrollView ref={scrollRef} contentContainerStyle={[styles.content, bottomSpace]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill, bottomSpace]}>{children}</View>
  );

  return (
    <View style={styles.fill}>
      <Aurora variant={aurora} />
      <SafeAreaView edges={edges} style={styles.fill}>
        <View ref={frame} collapsable={false} style={styles.fill}>
          <View style={[styles.fill, { paddingBottom: keyboardInset }]}>
            {body}
            {footer && <View style={styles.footer}>{footer}</View>}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.xl,
    gap: Spacing.xl,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
});
