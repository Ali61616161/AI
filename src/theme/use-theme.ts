import { useColorScheme } from '@/hooks/use-color-scheme';

import { Colors, type ThemeColors } from './tokens';

export function useTheme(): { colors: ThemeColors; isDark: boolean } {
  const isDark = useColorScheme() === 'dark';
  return { colors: isDark ? Colors.dark : Colors.light, isDark };
}
