import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAppearanceStore } from '@/stores/appearance-store';

import { Colors, type ThemeColors } from './tokens';

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const system = useColorScheme();
  const appearance = useAppearanceStore((s) => s.appearance);
  const isDark = appearance === 'system' ? system === 'dark' : appearance === 'dark';
  return { colors: isDark ? Colors.dark : Colors.light, isDark };
}
