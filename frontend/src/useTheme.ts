import { COLORS, type ThemeColors } from './theme';
import { useColorScheme } from 'react-native';

export function useTheme(): ThemeColors {
  const scheme = useColorScheme();
  return scheme === 'dark' ? COLORS.dark : COLORS.light;
}
