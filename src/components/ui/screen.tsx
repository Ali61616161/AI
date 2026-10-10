import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

type Props = {
  children: ReactNode;
  /** Alt kısımda sabit duran içerik (ör. "Devam" butonu). */
  footer?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
};

export function Screen({ children, footer, scroll = true, edges = ['top', 'bottom'] }: Props) {
  const { colors } = useTheme();
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, styles.fill]}>{children}</View>
  );

  return (
    <SafeAreaView edges={edges} style={[styles.fill, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {body}
        {footer && <View style={styles.footer}>{footer}</View>}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: {
    flexGrow: 1,
    padding: Spacing.xl,
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
