'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeId = 'deep-space' | 'light' | 'midnight-purple' | 'forest-dark' | 'material';

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
];

interface ThemeContextValue {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'deep-space',
  setTheme: () => {},
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeId>('deep-space');

  useEffect(() => {
    const stored = localStorage.getItem('app-theme') as ThemeId | null;
    if (stored && themes.find((t) => t.id === stored)) {
      setThemeState(stored);
      document.documentElement.setAttribute('data-theme', stored);
    }
  }, []);

  const setTheme = (t: ThemeId) => {
    setThemeState(t);
    localStorage.setItem('app-theme', t);
    document.documentElement.setAttribute('data-theme', t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
