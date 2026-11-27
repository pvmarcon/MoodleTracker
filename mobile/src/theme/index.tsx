import { createContext, useContext, type ReactNode } from 'react';
import type { ThemePref } from '@/types';

/** Same tokens as the web app (Linear-like neutrals + Duolingo accents). */
export const palettes = {
  dark: {
    bg: '#0b0b0f',
    surface: '#141419',
    surface2: '#1c1c23',
    line: '#26262e',
    fg: '#f4f4f5',
    muted: '#a1a1aa',
    subtle: '#71717a',
    accent: '#7c6cff',
    accentDark: '#5243d6',
    success: '#58cc02',
    successDark: '#46a302',
    warning: '#ffb020',
    danger: '#ff4b4b',
    backdrop: 'rgba(0,0,0,0.6)',
  },
  light: {
    bg: '#fafafa',
    surface: '#ffffff',
    surface2: '#f4f4f5',
    line: '#e4e4e7',
    fg: '#18181b',
    muted: '#52525b',
    subtle: '#a1a1aa',
    accent: '#5e4ff0',
    accentDark: '#4336c4',
    success: '#58cc02',
    successDark: '#46a302',
    warning: '#e69600',
    danger: '#e63c3c',
    backdrop: 'rgba(0,0,0,0.4)',
  },
};

export type Colors = (typeof palettes)['dark'];

/** Hex + alpha (0..1) -> rgba string. */
export const alpha = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

const Ctx = createContext<{ c: Colors; mode: ThemePref }>({ c: palettes.dark, mode: 'dark' });

export function ThemeProvider({ mode, children }: { mode: ThemePref; children: ReactNode }) {
  return <Ctx.Provider value={{ c: palettes[mode], mode }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);

export const radius = { sm: 8, md: 12, lg: 16, xl: 24 };
