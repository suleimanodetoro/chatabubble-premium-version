// lib/theme/ThemeProvider.tsx
import React, { ReactNode } from 'react';
import { ThemeContext, theme } from './theme';

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}