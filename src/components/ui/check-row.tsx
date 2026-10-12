import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Gradients, Spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/use-theme';

import { Tap } from './tap';

/** Onay kutusu ve yanında (bağlantı içerebilen) metin. */
export function CheckRow({ checked, onChange, label, children }: { checked: boolean; onChange: (v: boolean) => void; label: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Tap accessibilityRole="checkbox" accessibilityState={{ checked }} accessibilityLabel={label} onPress={() => onChange(!checked)} feedback="select" scaleTo={0.99} style={styles.row}>
      {checked ? (
        <LinearGradient colors={Gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.box}>
          <Ionicons name="checkmark" size={16} color="#FFFFFF" />
        </LinearGradient>
      ) : (
        <View style={[styles.box, { borderColor: colors.borderStrong, borderWidth: 2 }]} />
      )}
      <View style={styles.text}>{children}</View>
    </Tap>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md },
  box: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  text: { flex: 1 },
});
