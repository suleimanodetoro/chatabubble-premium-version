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
  scenarios: Scenario[];
  activeSessions: Record<string, Session>;

  // Actions
  setUser: (user: User | null) => void;
  setCurrentSession: (session: Session | null) => void;
  setCurrentScenario: (scenario: Scenario | null) => void;
  setTargetLanguage: (language: Language | null) => void;
  setSourceLanguage: (language: Language | null) => void;
  addScenario: (scenario: Scenario) => void;
  saveSession: (session: Session) => void;
  loadSession: (sessionId: string) => Session | null;
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
      scenarios: [],
      activeSessions: {},

      // Actions
      setUser: (user) => set({ user }),
      setCurrentSession: (session) => set({ currentSession: session }),
      setCurrentScenario: (scenario) => set({ currentScenario: scenario }),
      setTargetLanguage: (language) => set({ targetLanguage: language }),
      setSourceLanguage: (language) => set({ sourceLanguage: language }),
      
      addScenario: (scenario) => set((state) => {
        console.log('Adding scenario:', scenario);
        return { scenarios: [...state.scenarios, scenario] };
      }),

      // New Actions with Logging
      saveSession: (session) => {
        console.log('Saving session:', session);
        set((state) => ({
          activeSessions: {
            ...state.activeSessions,
            [session.id]: session
          },
          currentSession: session
        }));
      },
      
      loadSession: (sessionId) => {
        const session = get().activeSessions[sessionId];
        console.log('Loading session:', { sessionId, found: !!session });
        return session || null;
      },
    }),
    {
      name: 'app-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        scenarios: state.scenarios,
        activeSessions: state.activeSessions,
        sourceLanguage: state.sourceLanguage,
      }),
    }
  )
);
