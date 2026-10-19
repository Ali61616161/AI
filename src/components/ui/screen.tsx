import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
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
  // Sayfa ekranın tepesinden başlamıyorsa (iOS "sheet" olarak açılan ekranlar) klavye payı o kadar artar;
  // aksi halde yazı alanı klavyenin altında kalır.
  const frame = useRef<View>(null);
  const [windowTop, setWindowTop] = useState(0);
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
        <View ref={frame} style={styles.fill} onLayout={() => frame.current?.measureInWindow((_x, y) => setWindowTop((prev) => (Math.abs(prev - y) > 1 ? y : prev)))}>
          <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'web' ? undefined : 'padding'} keyboardVerticalOffset={windowTop}>
          {body}
          {footer && <View style={styles.footer}>{footer}</View>}
          </KeyboardAvoidingView>
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
