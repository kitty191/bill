import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  AccessibilityInfo,
  AppState,
  Platform,
  useColorScheme,
} from 'react-native';

const light = {
  dark: false,
  reduceTransparency: false,
  background: '#F5F7F2',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2EC',
  text: '#1E352B',
  muted: '#617467',
  subtle: '#7B8B80',
  border: '#E1E7DF',
  cardBorder: '#E6ECE4',
  accent: '#275B44',
  accentSoft: '#E5EFE7',
  primary: '#275B44',
  onPrimary: '#FFFFFF',
  primaryBorder: '#43745D',
  heroSurface: '#EAF2EC',
  heroBorder: '#D5E4D9',
  heroDivider: '#D1E0D5',
  income: '#2E6E51',
  expense: '#B46F56',
  glass: 'rgba(252,254,250,0.80)',
  sheet: 'rgba(252,254,250,0.96)',
  glassEdge: 'rgba(255,255,255,0.92)',
  glassHighlight: 'rgba(255,255,255,0.78)',
  glassShade: 'rgba(104,138,112,0.06)',
  shadow: 'rgba(24,48,34,0.11)',
  cardShadow: '0 4px 18px rgba(27,54,38,0.042)',
  pillShadow: '0 2px 8px rgba(27,54,38,0.065)',
  overlay: 'rgba(20,36,28,0.32)',
  danger: '#B84F4F',
};
const dark: typeof light = {
  dark: true,
  reduceTransparency: false,
  background: '#0E1712',
  surface: '#17241D',
  surfaceAlt: '#203127',
  text: '#EAF1EB',
  muted: '#9CB0A2',
  subtle: '#788D7F',
  border: '#27392E',
  cardBorder: '#24352B',
  accent: '#9BCBA8',
  accentSoft: '#263D30',
  primary: '#9BCBA8',
  onPrimary: '#132B1E',
  primaryBorder: '#B7DFC2',
  heroSurface: '#1B2E23',
  heroBorder: '#2A4234',
  heroDivider: '#2E4739',
  income: '#9BCBA8',
  expense: '#E4A88B',
  glass: 'rgba(24,38,30,0.84)',
  sheet: 'rgba(22,35,28,0.97)',
  glassEdge: 'rgba(213,238,217,0.14)',
  glassHighlight: 'rgba(222,246,226,0.10)',
  glassShade: 'rgba(0,10,4,0.16)',
  shadow: 'rgba(0,8,3,0.34)',
  cardShadow: 'none',
  pillShadow: 'none',
  overlay: 'rgba(0,0,0,0.58)',
  danger: '#E89F9F',
};
export type Theme = typeof light;
const Context = createContext(light);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const [reduceTransparency, setReduceTransparency] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') {
      const preference = window.matchMedia(
        '(prefers-reduced-transparency: reduce)',
      );
      const update = () => setReduceTransparency(preference.matches);
      update();
      preference.addEventListener('change', update);
      return () => preference.removeEventListener('change', update);
    }
    let mounted = true;
    const read = () => {
      void AccessibilityInfo.isReduceTransparencyEnabled()
        .then((value) => {
          if (mounted) setReduceTransparency(value);
        })
        .catch(() => {});
    };
    read();
    const change = AccessibilityInfo.addEventListener(
      'reduceTransparencyChanged',
      setReduceTransparency,
    );
    const active = AppState.addEventListener('change', (state) => {
      if (state === 'active') read();
    });
    return () => {
      mounted = false;
      change.remove();
      active.remove();
    };
  }, []);
  const value = useMemo(() => {
    const base = scheme === 'dark' ? dark : light;
    return reduceTransparency
      ? {
          ...base,
          reduceTransparency,
          glass: base.surface,
          sheet: base.surface,
          glassEdge: base.border,
          glassHighlight: base.surface,
          glassShade: base.surface,
        }
      : base;
  }, [scheme, reduceTransparency]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useTheme = () => useContext(Context);
