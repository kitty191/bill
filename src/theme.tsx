import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

const light = {
  dark: false,
  background: '#F6F7F3',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F3EE',
  text: '#253D33',
  muted: '#687A6E',
  subtle: '#758175',
  border: '#E3E9E1',
  accent: '#427B63',
  accentSoft: '#E5EFE6',
  income: '#50876F',
  expense: '#B6765E',
  glass: 'rgba(250,253,248,0.76)',
  sheet: 'rgba(252,254,250,0.96)',
  glassEdge: 'rgba(255,255,255,0.88)',
  glassHighlight: 'rgba(255,255,255,0.72)',
  glassShade: 'rgba(114,146,120,0.07)',
  shadow: 'rgba(31,60,42,0.12)',
  overlay: 'rgba(24,42,33,0.28)',
  danger: '#B65353',
};
const dark: typeof light = {
  dark: true,
  background: '#111B16',
  surface: '#1B2921',
  surfaceAlt: '#24362B',
  text: '#E7EEE7',
  muted: '#A0B2A6',
  subtle: '#7F9385',
  border: '#304136',
  accent: '#A0CCAD',
  accentSoft: '#2C4535',
  income: '#A0CCAD',
  expense: '#E3AA8E',
  glass: 'rgba(30,46,36,0.82)',
  sheet: 'rgba(26,40,32,0.97)',
  glassEdge: 'rgba(213,238,217,0.18)',
  glassHighlight: 'rgba(222,246,226,0.12)',
  glassShade: 'rgba(0,10,4,0.14)',
  shadow: 'rgba(0,8,3,0.30)',
  overlay: 'rgba(0,0,0,0.55)',
  danger: '#E8A3A3',
};
export type Theme = typeof light;
const Context = createContext(light);
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  return (
    <Context.Provider value={scheme === 'dark' ? dark : light}>
      {children}
    </Context.Provider>
  );
}
export const useTheme = () => useContext(Context);
