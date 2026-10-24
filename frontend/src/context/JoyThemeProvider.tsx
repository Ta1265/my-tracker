'use client';

import React from 'react';
import { CssVarsProvider, extendTheme } from '@mui/joy';

const baseTheme = extendTheme();

/** Dark-only Joy theme — matches the app's always-dark UI. */
const joyTheme = extendTheme({
  colorSchemes: {
    light: baseTheme.colorSchemes.dark,
    dark: baseTheme.colorSchemes.dark,
  },
});

export function JoyThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <CssVarsProvider theme={joyTheme} defaultMode="dark">
      {children}
    </CssVarsProvider>
  );
}
