import { useColorScheme } from 'react-native';

/**
 * Дизайн-токени (аналог AppThemeBinding / ResourceDictionary, лаб. 3).
 * Стиль: теплий нейтральний фон, «чорнильні» кнопки-пігулки, кораловий акцент
 * і пастельні кольори предметів.
 */
const light = {
  background: '#F2EAE3',
  surface: '#FFFFFF',
  surfaceAlt: '#F4EFEB',
  text: '#16151C',
  textMuted: '#626A77',
  border: '#E7DDD6',
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
  tabBar: '#FFFFFF',
  tabInactive: '#626A77',
  shadow: 'rgba(30, 40, 55, 0.06)',
  /** Темна «геро»-картка. */
  ink: '#16151C',
  inkText: '#FFFFFF',
  inkMuted: '#A9A6B2',
};

const dark: typeof light = {
  background: '#121116',
  surface: '#2B2830',
  surfaceAlt: '#3A353E',
  text: '#FAF7F5',
  textMuted: '#C5BEC4',
  border: '#554D56',
  primary: '#F4F2EE',
  primaryText: '#0E0D12',
  primarySoft: '#3A353E',
  accent: '#FF7D52',
  accentSoft: '#543025',
  accentText: '#0E0D12',
  success: '#4ADE80',
  successBg: '#15301F',
  warning: '#FBBF24',
  warningBg: '#33280F',
  danger: '#F87171',
  dangerBg: '#3A1C1C',
  tabBar: '#302C34',
  tabInactive: '#C5BEC4',
  shadow: 'rgba(0, 0, 0, 0.5)',
  ink: '#3A353E',
  inkText: '#F4F2EE',
  inkMuted: '#C5BEC4',
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
