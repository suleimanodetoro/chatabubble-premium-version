// hooks/useAppStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Language, Scenario, Session, User } from "../types";
import { StorageService } from "@/lib/services/storage";
import { ScenarioService } from "@/lib/services/scenario";
import { supabase } from '@/lib/supabase/client';

interface AppState {
  user: User | null;
  currentSession: Session | null;
  currentScenario: Scenario | null;
  targetLanguage: Language | null;
  sourceLanguage: Language | null;
  scenarios: Scenario[];
  activeSessions: Record<string, Session>;
  isPremium: boolean; // Add this
  loadScenarios: () => Promise<void>;

  // Actions
  setUser: (user: User | null) => void;
  setCurrentSession: (session: Session | null) => void;
  setCurrentScenario: (scenario: Scenario | null) => void;
  setTargetLanguage: (language: Language | null) => void;
  setSourceLanguage: (language: Language | null) => void;
  addScenario: (scenario: Scenario) => void;
  saveSession: (session: Session) => Promise<void>;
  loadSession: (sessionId: string) => Promise<Session | null>;
  setIsPremium: (status: boolean) => void; // Add this
}

const DEFAULT_SOURCE_LANGUAGE: Language = {
  code: "en",
  name: "English",
  direction: "ltr",
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
      isPremium: false, 

      setUser: (user) => set({ user }),
      setCurrentSession: (session) => set({ currentSession: session }),
      setCurrentScenario: (scenario) => set({ currentScenario: scenario }),
      setTargetLanguage: (language) => set({ targetLanguage: language }),
      setSourceLanguage: (language) => set({ sourceLanguage: language }),
      setIsPremium: (status) => set({ isPremium: status }), 
      

      addScenario: (scenario) =>
        set((state) => {
          console.log("Adding scenario:", scenario);
          return { scenarios: [...state.scenarios, scenario] };
        }),

        saveSession: async (session) => {
          console.log("Saving session:", session);
          try {
            // Make sure we have the latest messages
            const messages = await StorageService.loadChatHistory(session.id);
            const sessionToSave = {
              ...session,
              messages,
              lastUpdated: Date.now()
            };
            
            // Save using StorageService first
            await StorageService.saveSession(sessionToSave);
            
            // Then update store state
            set((state) => ({
              activeSessions: {
                ...state.activeSessions,
                [session.id]: sessionToSave,
              },
              currentSession: sessionToSave,
              targetLanguage: session.targetLanguage,
            }));
          } catch (error) {
            console.error("Error saving session:", error);
            throw error;
          }
        },

      loadSession: async (sessionId) => {
        try {
          console.log('Loading session from storage:', sessionId);
          // Try loading from StorageService first
          const storedSession = await StorageService.loadSession(sessionId);
          
          if (storedSession) {
            console.log('Found stored session with messages:', storedSession.messages?.length);
            // Update store state with loaded session
            set((state) => ({
              activeSessions: {
                ...state.activeSessions,
                [sessionId]: storedSession,
              },
              currentSession: storedSession,  // Added line
              targetLanguage: storedSession.targetLanguage, // Added line
            }));
            return storedSession;
          }
          
          // Fallback to store state if not found in storage
          const session = get().activeSessions[sessionId];
          if (session) {
            set({ targetLanguage: session.targetLanguage });
          }
          
          console.log("Loading session:", {
            sessionId,
            found: !!session,
            targetLanguage: session?.targetLanguage,
          });
          
          return session || null;
        } catch (error) {
          console.error("Error loading session:", error);
          return null;
        }
      },
      // In useAppStore.ts, modify the loadScenarios function:
loadScenarios: async () => {
  try {
    const user = get().user;
    if (!user?.id) return;

    const { data: scenarios, error } = await supabase
      .from('scenarios')
      .select('*')
      .or(`created_by.eq.${user.id},is_public.eq.true`);

    if (error) throw error;

    const transformedScenarios = scenarios.map(scenario => ({
      ...scenario,
      targetLanguage: scenario.target_language,
      category: scenario.category,
      difficulty: scenario.difficulty,
      persona: scenario.persona,
    }));

    set({ scenarios: transformedScenarios });
  } catch (error) {
    console.error('Error loading scenarios:', error);
  }
},
    }),
    {
      name: "app-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        scenarios: state.scenarios,
        activeSessions: state.activeSessions,
        sourceLanguage: state.sourceLanguage,
        user: state.user,
        isPremium: state.isPremium, 
      }),
    }
  )
);
