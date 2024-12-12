// hooks/useAppStore.ts
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Language, Scenario, Session, User } from "../types";
import { StorageService } from "@/lib/services/storage";

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
  saveSession: (session: Session) => Promise<void>;
  loadSession: (sessionId: string) => Promise<Session | null>;
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

      setUser: (user) => set({ user }),
      setCurrentSession: (session) => set({ currentSession: session }),
      setCurrentScenario: (scenario) => set({ currentScenario: scenario }),
      setTargetLanguage: (language) => set({ targetLanguage: language }),
      setSourceLanguage: (language) => set({ sourceLanguage: language }),

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
    }),
    {
      name: "app-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        scenarios: state.scenarios,
        activeSessions: state.activeSessions,
        sourceLanguage: state.sourceLanguage,
        user: state.user,
      }),
    }
  )
);
