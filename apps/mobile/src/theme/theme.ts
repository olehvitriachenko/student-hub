import { useColorScheme } from 'react-native';

/** Палітри для світлої та темної теми (аналог AppThemeBinding, лаб. 3). */
const light = {
  background: '#F4F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F6',
  text: '#121826',
  textMuted: '#5B6476',
  border: '#DCE1EA',
  primary: '#2F5BEA',
  primaryText: '#FFFFFF',
  success: '#1E8E5A',
  successBg: '#E3F6EC',
  warning: '#B26B00',
  danger: '#C8352E',
  dangerBg: '#FDECEB',
};

const dark: typeof light = {
  background: '#0E1117',
  surface: '#171B24',
  surfaceAlt: '#1F2430',
  text: '#E8EBF2',
  textMuted: '#98A1B3',
  border: '#2A3040',
  primary: '#6E8CFF',
  primaryText: '#0E1117',
  success: '#4CC38A',
  successBg: '#15301F',
  warning: '#E0A243',
  danger: '#F2726B',
  dangerBg: '#3A1D1C',
};

export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;
