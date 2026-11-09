import { useColorScheme } from 'react-native';

/**
 * Дизайн-токени (аналог AppThemeBinding / ResourceDictionary, лаб. 3).
 * Стиль: теплий нейтральний фон, «чорнильні» кнопки-пігулки, кораловий акцент
 * і пастельні кольори предметів.
 */
const light = {
  background: '#F6F3EE',
  surface: '#FFFFFF',
  surfaceAlt: '#EFEBE4',
  text: '#16151C',
  textMuted: '#7D7A84',
  border: '#E6E1D8',
  /** Основні кнопки, активні чіпи, темні картки. */
  primary: '#16151C',
  primaryText: '#FFFFFF',
  primarySoft: '#EFEBE4',
  /** Акцент: активна вкладка, «зараз», прогрес, посилання. */
  accent: '#FF6B3D',
  accentSoft: '#FFE4D8',
  accentText: '#FFFFFF',
  success: '#1E9A62',
  successBg: '#DCF3E6',
  warning: '#C27300',
  warningBg: '#FFF0D4',
  danger: '#E0443A',
  dangerBg: '#FDE4E1',
  tabBar: '#16151C',
  tabInactive: '#8D8A96',
  shadow: 'rgba(40, 30, 20, 0.10)',
  /** Темна «геро»-картка. */
  ink: '#16151C',
  inkText: '#FFFFFF',
  inkMuted: '#A9A6B2',
};

const dark: typeof light = {
  background: '#0E0D12',
  surface: '#18171E',
  surfaceAlt: '#23222B',
  text: '#F4F2EE',
  textMuted: '#8E8B97',
  border: '#2A2932',
  primary: '#F4F2EE',
  primaryText: '#0E0D12',
  primarySoft: '#23222B',
  accent: '#FF7D52',
  accentSoft: '#3A231B',
  accentText: '#0E0D12',
  success: '#4ADE80',
  successBg: '#15301F',
  warning: '#FBBF24',
  warningBg: '#33280F',
  danger: '#F87171',
  dangerBg: '#3A1C1C',
  tabBar: '#23222B',
  tabInactive: '#8E8B97',
  shadow: 'rgba(0, 0, 0, 0.5)',
  ink: '#23222B',
  inkText: '#F4F2EE',
  inkMuted: '#9E9BA8',
};

export type Palette = typeof light;

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}

export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 12, md: 16, lg: 24, xl: 32, pill: 999 } as const;

/** Місце під плаваючий таб-бар — екрани вкладок додають цей відступ знизу. */
export const TAB_BAR_SPACE = 120;

/** Пастельні пари (фон, текст/іконка) для предметів і категорій подій. */
const PASTELS_LIGHT = [
  { bg: '#E6E1FF', fg: '#4B3FC7' }, // лаванда
  { bg: '#D6F1E2', fg: '#1E7A4E' }, // м'ята
  { bg: '#FFE1D3', fg: '#C24E1E' }, // персик
  { bg: '#D9E9FF', fg: '#2459B8' }, // небо
  { bg: '#FFF0B8', fg: '#8A6500' }, // лимон
  { bg: '#FFDDEA', fg: '#B8336A' }, // рожевий
  { bg: '#D5F0F2', fg: '#17727A' }, // бірюза
];
const PASTELS_DARK = [
  { bg: '#2B2650', fg: '#B9B0FF' },
  { bg: '#173526', fg: '#7DDBA6' },
  { bg: '#3E2418', fg: '#FFAE8A' },
  { bg: '#182A45', fg: '#8DB8FF' },
  { bg: '#3A3112', fg: '#F5D06B' },
  { bg: '#3D1C2B', fg: '#FF9DC3' },
  { bg: '#123336', fg: '#7DD6DC' },
];

export type Pastel = { bg: string; fg: string };

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(h);
}

/** Стабільний пастельний колір для предмета (за хешем назви). */
export function usePastel(): (key: string) => Pastel {
  const list = useIsDark() ? PASTELS_DARK : PASTELS_LIGHT;
  return (key: string) => list[hash(key) % list.length];
}
