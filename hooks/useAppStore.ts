// hooks/useAppStore.ts
import { create } from 'zustand';
import { Language, Scenario, Session, User } from '../types';

interface AppState {
  user: User | null;
  currentSession: Session | null;
  currentScenario: Scenario | null;
  targetLanguage: Language | null;
  sourceLanguage: Language | null;
  sessions: Session[];
  scenarios: Scenario[];
  
  // Actions
  setUser: (user: User | null) => void;
  setCurrentSession: (session: Session | null) => void;
  setCurrentScenario: (scenario: Scenario | null) => void;
  setTargetLanguage: (language: Language | null) => void;
  setSourceLanguage: (language: Language | null) => void;
  addSession: (session: Session) => void;
  addScenario: (scenario: Scenario) => void;
}

const DEFAULT_SOURCE_LANGUAGE: Language = {
  code: 'en',
  name: 'English',
  direction: 'ltr'
};

const DEFAULT_TARGET_LANGUAGE: Language = {
  code: 'es',
  name: 'Spanish',
  direction: 'ltr'
};

export const useAppStore = create<AppState>((set) => ({
  user: null,
  currentSession: null,
  currentScenario: null,
  targetLanguage: DEFAULT_TARGET_LANGUAGE, // Set default target language
  sourceLanguage: DEFAULT_SOURCE_LANGUAGE, // Set default source language
  sessions: [],
  scenarios: [],

  setUser: (user) => set({ user }),
  setCurrentSession: (session) => set({ currentSession: session }),
  setCurrentScenario: (scenario) => set({ currentScenario: scenario }),
  setTargetLanguage: (language) => set({ targetLanguage: language }),
  setSourceLanguage: (language) => set({ sourceLanguage: language }),
  addSession: (session) => set((state) => ({ 
    sessions: [...state.sessions, session],
    currentSession: session 
  })),
  addScenario: (scenario) => set((state) => ({ 
    scenarios: [...state.scenarios, scenario] 
  })),
}));