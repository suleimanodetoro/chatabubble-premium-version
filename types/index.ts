// types/index.ts
export interface Language {
  code: string;
  name: string;
  direction: "ltr" | "rtl";
  isCustom?: boolean;
}
export interface SubscriptionStatus {
    isSubscribed: boolean;
    expiryDate?: string;
    plan?: string;
  }

export interface User {
  id: string;
  name: string;
  email: string;
  nativeLanguage: Language;
  learningLanguages: Language[];
  subscription?: SubscriptionStatus;

  currentLevel: {
    [languageCode: string]: "beginner" | "intermediate" | "advanced";
  };
}

export interface ChatMessage {
  id: string;
  content: {
    original: string;
    translated: string;
  };
  sender: "user" | "assistant";
  timestamp: number;
  isEdited: boolean;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  category: "shopping" | "dining" | "travel" | "business" | "casual";
  difficulty: "beginner" | "intermediate" | "advanced";
  persona: {
    name: string;
    role: string;
    personality: string;
    languageStyle: "formal" | "casual" | "mixed";
  };
  target_language: Language;
}

export interface Session {
    id: string;
    userId: string;
    scenarioId: string;
    target_language: Language;  
    source_language: Language;
    messages: ChatMessage[];
    startTime: number;
    lastUpdated: number;
    scenario?: Scenario;    // Optional - might cause issues if we're not checking
    status: "active" | "completed" | "saved";
    metrics?: {            // Optional - need to handle this in MetricsService
      messageCount?: number;
      duration?: number;
      lastUpdated?: number;
    };
  }

export const PREDEFINED_LANGUAGES: Language[] = [
  { code: "es", name: "Spanish", direction: "ltr" },
  { code: "fr", name: "French", direction: "ltr" },
  { code: "de", name: "German", direction: "ltr" },
  { code: "it", name: "Italian", direction: "ltr" },
  { code: "pt", name: "Portuguese", direction: "ltr" },
  { code: "ru", name: "Russian", direction: "ltr" },
  { code: "ja", name: "Japanese", direction: "ltr" },
  { code: "zh", name: "Chinese", direction: "ltr" },
  { code: "ko", name: "Korean", direction: "ltr" },
  { code: "ar", name: "Arabic", direction: "rtl" },
  { code: "yo", name: "Yoruba", direction: "ltr" },
  { code: "ha", name: "Hausa", direction: "ltr" },
  { code: "ig", name: "Igbo", direction: "ltr" },
];

export type RootStackParamList = {
  "/": undefined;
  "/(tabs)": undefined;
  "/(tabs)/index": undefined;
  "/(tabs)/scenarios": undefined;
  "/(tabs)/profile": undefined;
  "/create-scenario": undefined;
  "/(chat)/[id]": { id: string };
};

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
