import React, { createContext, useContext } from 'react';
import { useColorScheme } from 'react-native';

const light = {
  dark: false,
  background: '#F5F6F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F0F3ED',
  text: '#253D33',
  muted: '#687A6E',
  subtle: '#758175',
  border: '#E7EBE4',
  accent: '#427B63',
  accentSoft: '#E5EFE6',
  income: '#50876F',
  expense: '#B6765E',
  glass: 'rgba(255,255,255,0.78)',
  overlay: 'rgba(24,42,33,0.28)',
  danger: '#B65353',
};
const dark: typeof light = {
  dark: true,
  background: '#131D18',
  surface: '#1D2A22',
  surfaceAlt: '#25352B',
  text: '#E7EEE7',
  muted: '#A0B2A6',
  subtle: '#7F9385',
  border: '#304136',
  accent: '#A0CCAD',
  accentSoft: '#2C4535',
  income: '#A0CCAD',
  expense: '#E3AA8E',
  glass: 'rgba(29,42,34,0.86)',
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
