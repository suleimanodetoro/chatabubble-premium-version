// hooks/useAppStore.ts

import { create } from 'zustand';
import { Language, User, Session, Scenario } from '../types';

interface AppState {
  user: User | null;
  currentSession: Session | null;
  currentScenario: Scenario | null;
  sourceLanguage: Language | null;
  targetLanguage: Language | null;
  isLoading: boolean;
  colorScheme: 'light' | 'dark';
  
  // Actions
  setUser: (user: User | null) => void;
  setCurrentSession: (session: Session | null) => void;
  setCurrentScenario: (scenario: Scenario | null) => void;
  setSourceLanguage: (language: Language | null) => void;
  setTargetLanguage: (language: Language | null) => void;
  setIsLoading: (loading: boolean) => void;
  setColorScheme: (scheme: 'light' | 'dark') => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  currentSession: null,
  currentScenario: null,
  sourceLanguage: null,
  targetLanguage: null,
  isLoading: false,
  colorScheme: 'light',

  // Actions
  setUser: (user) => set({ user }),
  setCurrentSession: (session) => set({ currentSession: session }),
  setCurrentScenario: (scenario) => set({ currentScenario: scenario }),
  setSourceLanguage: (language) => set({ sourceLanguage: language }),
  setTargetLanguage: (language) => set({ targetLanguage: language }),
  setIsLoading: (loading) => set({ isLoading: loading }),
  setColorScheme: (scheme) => set({ colorScheme: scheme }),
}));