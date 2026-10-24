'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type BackgroundId = 'default' | 'forest-mist' | 'waves' | 'sunset-waves';

export interface Background {
  id: BackgroundId;
  label: string;
  icon: string;
  src?: string;
}

export const backgrounds: Background[] = [
  { id: 'default',     label: 'Default',      icon: '◼', src: undefined },
  { id: 'forest-mist', label: 'Forest Mist',  icon: '🌲', src: '/forest-mist.jpg' },
  { id: 'waves', label: 'Waves',   icon: '🌃', src: '/bright-waves.jpg' },
  { id: 'sunset-waves', label: 'Sunset Waves', icon: '🌅', src: '/sunset-waves.jpg' },
];

interface BackgroundContextValue {
  background: BackgroundId;
  setBackground: (bg: BackgroundId) => void;
}

const BackgroundContext = createContext<BackgroundContextValue>({
  background: 'default',
  setBackground: () => {},
});

export const BackgroundProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [background, setBackgroundState] = useState<BackgroundId>('default');

  // Sync background id to <html data-bg="..."> so CSS can target it
  useEffect(() => {
    if (background !== 'default') {
      document.documentElement.setAttribute('data-bg', background);
    } else {
      document.documentElement.removeAttribute('data-bg');
    }
  }, [background]);

  useEffect(() => {
    const stored = localStorage.getItem('app-background') as BackgroundId | null;
    if (stored && backgrounds.find((b) => b.id === stored)) {
      setBackgroundState(stored);
    }
  }, []);

  const setBackground = (bg: BackgroundId) => {
    setBackgroundState(bg);
    localStorage.setItem('app-background', bg);
  };

  return (
    <BackgroundContext.Provider value={{ background, setBackground }}>
      {children}
    </BackgroundContext.Provider>
  );
};

export const useBackground = () => useContext(BackgroundContext);
