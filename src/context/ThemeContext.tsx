'use client';

import React, { createContext, useContext, useEffect, useMemo } from 'react';
import {
  createTheme,
  ThemeProvider as MuiThemeProvider,
  THEME_ID,
} from '@mui/material/styles';
import type { Theme as MuiTheme } from '@mui/material/styles';
import { useLocalStorage } from '../_hooks/useLocalStorage';

declare module '@mui/material/styles' {
  interface Palette {
    borderAccent: string;
    primaryGlow: string;
  }
  interface PaletteOptions {
    borderAccent?: string;
    primaryGlow?: string;
  }
}

export type ThemeId = 'deep-space' | 'light' | 'midnight-purple' | 'forest-dark' | 'material' | 'slate-gold';

export interface Theme {
  id: ThemeId;
  label: string;
}

export const themes: Theme[] = [
  { id: 'deep-space', label: 'Deep Space' },
  { id: 'light', label: 'Light' },
  { id: 'midnight-purple', label: 'Ember Dark' },
  { id: 'forest-dark', label: 'Forest' },
  { id: 'material', label: 'Material' },
  { id: 'slate-gold', label: 'Slate Gold' },
];

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'deep-space',
  setTheme: () => {},
});

// ─── Per-theme design tokens (mirrors globals.css exactly) ───────────────────

interface ThemeTokens {
  mode: 'light' | 'dark';
  primary: string;
  primaryLight: string;
  primaryGlow: string;
  error: string;
  success: string;
  bgDefault: string;
  bgPaper: string;
  bgCard: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  borderSubtle: string;
  borderMedium: string;
  borderAccent: string;
}

function hexAlpha(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildMuiTheme(t: ThemeTokens): MuiTheme {
  return createTheme({
    palette: {
      mode: t.mode,
      primary:    { main: t.primary, light: t.primaryLight },
      error:      { main: t.error },
      success:    { main: t.success },
      background: { default: t.bgDefault, paper: t.bgCard },
      text:       { primary: t.textPrimary, secondary: t.textSecondary, disabled: t.textMuted },
      divider:    t.borderSubtle,
      borderAccent: t.borderAccent,
      primaryGlow: t.primaryGlow,
    },
    shape: { borderRadius: 10 },
    components: {
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: t.borderSubtle,
            borderRadius: 10,
            color: t.textPrimary,
            fontSize: 14,
            transition: 'box-shadow 0.2s',
            '& fieldset': {
              borderColor: t.borderSubtle,
              transition: 'border-color 0.2s',
            },
            '&:hover fieldset': { borderColor: t.borderMedium },
            '&.Mui-focused': { boxShadow: `0 0 0 3px ${hexAlpha(t.primary, 0.18)}` },
            '&.Mui-focused fieldset': { borderColor: `${t.borderAccent} !important` },
            '&.Mui-error fieldset': { borderColor: `${t.error} !important` },
          },
          input: {
            padding: '11px 12px',
            '&:focus, &:focus-visible': {
              outline: 'none',
              '--tw-ring-shadow': '0 0 0 0 transparent',
              '--tw-ring-color': 'transparent',
              boxShadow: 'none',
            },
            '&::placeholder': { color: t.textMuted, opacity: 1 },
            '&:-webkit-autofill, &:-webkit-autofill:hover, &:-webkit-autofill:focus': {
              WebkitBoxShadow: `0 0 0 100px ${t.bgCard} inset`,
              WebkitTextFillColor: t.textPrimary,
              caretColor: t.textPrimary,
            },
          },
        },
      },
      MuiInputAdornment: {
        styleOverrides: {
          root: { color: t.textMuted },
        },
      },
      MuiFormHelperText: {
        styleOverrides: {
          root: { color: t.error, fontSize: 12, marginTop: '5px', marginLeft: 0 },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          contained: {
            borderRadius: 10,
            textTransform: 'none',
            fontWeight: 600,
            padding: '12px 24px',
            fontSize: 15,
            letterSpacing: '-0.01em',
          },
          containedPrimary: {
            backgroundColor: t.primary,
            color: '#fff',
            boxShadow: `0 4px 24px ${t.primaryGlow}`,
            transition: 'background 0.2s, box-shadow 0.2s',
            '&:hover': {
              backgroundColor: t.primary,
              boxShadow: `0 4px 24px ${t.primaryGlow}`,
            },
            '&.Mui-disabled': {
              color: '#fff',
              backgroundColor: t.primaryGlow,
              boxShadow: 'none',
            },
          },
        },
      },
      MuiCheckbox: {
        styleOverrides: {
          root: {
            color: t.textMuted,
            padding: '2px 6px 2px 0',
            '&.Mui-checked': { color: t.primary },
            '&:hover': { background: 'transparent' },
            '& .MuiSvgIcon-root': { fontSize: 18 },
          },
        },
      },
      MuiFormControlLabel: {
        styleOverrides: {
          label: { fontSize: 13, color: t.textSecondary, userSelect: 'none' },
        },
      },
      MuiAlert: {
        styleOverrides: {
          standardError: {
            background: hexAlpha(t.error, 0.12),
            border: `1px solid ${hexAlpha(t.error, 0.35)}`,
            borderRadius: '10px',
            padding: '6px 14px',
            color: t.error,
            fontSize: 13.5,
            '& .MuiAlert-icon': { color: t.error, padding: 0, alignItems: 'center' },
            '& .MuiAlert-message': { padding: 0, display: 'flex', alignItems: 'center' },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { color: t.textMuted },
        },
      },
    },
  });
}


const muiThemes: Record<ThemeId, MuiTheme> = {
  'deep-space': buildMuiTheme({
    mode: 'dark',
    primary: '#3b82f6',       primaryLight: '#93c5fd',  primaryGlow: 'rgba(59, 130, 246, 0.15)',
    error: '#f43f5e',         success: '#10b981',
    bgDefault: '#080a0f',     bgPaper: '#000000',     bgCard: '#000000',
    textPrimary: '#f1f5f9',   textSecondary: '#94a3b8', textMuted: '#475569',
    borderSubtle: 'rgba(255,255,255,0.06)',
    borderMedium: 'rgba(255,255,255,0.10)',
    borderAccent: 'rgba(99,179,237,0.3)',
  }),
  'light': buildMuiTheme({
    mode: 'light',
    primary: '#2563eb',       primaryLight: '#93c5fd',  primaryGlow: 'rgba(37, 99, 235, 0.10)',
    error: '#dc2626',         success: '#059669',
    bgDefault: '#f0f2f5',     bgPaper: '#ffffff',     bgCard: '#ffffff',
    textPrimary: '#0f172a',   textSecondary: '#374151', textMuted: '#9ca3af',
    borderSubtle: 'rgba(0,0,0,0.09)',
    borderMedium: 'rgba(0,0,0,0.15)',
    borderAccent: 'rgba(37,99,235,0.4)',
  }),
  'midnight-purple': buildMuiTheme({
    mode: 'dark',
    primary: '#f97316',       primaryLight: '#fed7aa',  primaryGlow: 'rgba(249, 115, 22, 0.18)',
    error: '#fb7185',         success: '#34d399',
    bgDefault: '#100c08',     bgPaper: '#1c1208',     bgCard: '#1c1208',
    textPrimary: '#fef3e2',   textSecondary: '#fdba74', textMuted: '#92400e',
    borderSubtle: 'rgba(251,146,60,0.08)',
    borderMedium: 'rgba(251,146,60,0.14)',
    borderAccent: 'rgba(234,88,12,0.4)',
  }),
  'forest-dark': buildMuiTheme({
    mode: 'dark',
    primary: '#80cbc4',       primaryLight: '#b2dfdb',  primaryGlow: 'rgba(128, 203, 196, 0.18)',
    error: '#ff5370',         success: '#c3e88d',
    bgDefault: '#263238',     bgPaper: '#2e3c43',     bgCard: '#2e3c43',
    textPrimary: '#eeffff',   textSecondary: '#b2ccd6', textMuted: '#546e7a',
    borderSubtle: 'rgba(255,255,255,0.07)',
    borderMedium: 'rgba(128,203,196,0.18)',
    borderAccent: 'rgba(128,203,196,0.4)',
  }),
  'material': buildMuiTheme({
    mode: 'dark',
    primary: '#80cbc4',       primaryLight: '#b2dfdb',  primaryGlow: 'rgba(128, 203, 196, 0.15)',
    error: '#ff5370',         success: '#c3e88d',
    bgDefault: '#0f111a',     bgPaper: '#1a1c25',     bgCard: '#1a1c25',
    textPrimary: '#eeffff',   textSecondary: '#8f93a2', textMuted: '#4b526d',
    borderSubtle: 'rgba(137,221,255,0.06)',
    borderMedium: 'rgba(137,221,255,0.12)',
    borderAccent: 'rgba(128,203,196,0.35)',
  }),
  'slate-gold': buildMuiTheme({
    mode: 'dark',
    primary: '#c49c3f',       primaryLight: '#e8d5a3',  primaryGlow: 'rgba(196, 156, 63, 0.18)',
    error: '#e06b6b',         success: '#7ec8a4',
    bgDefault: '#0b0d14',     bgPaper: '#161a27',     bgCard: '#161a27',
    textPrimary: '#ede8d8',   textSecondary: '#a09880', textMuted: '#4e4635',
    borderSubtle: 'rgba(196,156,63,0.08)',
    borderMedium: 'rgba(196,156,63,0.16)',
    borderAccent: 'rgba(196,156,63,0.42)',
  }),
};

const DEFAULT_THEME_ID = 'deep-space';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeId, setThemeIdState] = useLocalStorage<ThemeId>('app-theme', DEFAULT_THEME_ID);

  useEffect(() => document.documentElement.setAttribute('data-theme', themeId), [themeId]);

  const setTheme = (t: ThemeId) => {
    setThemeIdState(t);
  };

  const muiTheme = useMemo(() => muiThemes[themeId], [themeId]);

  return (
    <ThemeContext.Provider value={{ theme: themeId, setTheme }}>
      <MuiThemeProvider theme={{ [THEME_ID]: muiTheme }}>
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
