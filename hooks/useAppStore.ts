// hooks/useAppStore.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
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

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      currentSession: null,
      currentScenario: null,
      targetLanguage: null,
      sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
      sessions: [],
      scenarios: [],

      setUser: (user) => set({ user }),
      setCurrentSession: (session) => set({ currentSession: session }),
      setCurrentScenario: (scenario) => set({ currentScenario: scenario }),
      setTargetLanguage: (language) => set({ targetLanguage: language }),
      setSourceLanguage: (language) => set({ sourceLanguage: language }),
      addSession: (session) => set((state) => {
        console.log('Adding session:', session);
        return { 
          sessions: [...state.sessions, session],
          currentSession: session 
        };
      }),
      addScenario: (scenario) => set((state) => {
        console.log('Adding scenario:', scenario);
        const newScenarios = [...state.scenarios, scenario];
        console.log('Updated scenarios:', newScenarios);
        return { scenarios: newScenarios };
      }),
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);