// types/index.ts

export type Language = {
    code: string;
    name: string;
    direction: 'ltr' | 'rtl';
  };
  
  export type User = {
    id: string;
    name: string;
    email: string;
    nativeLanguage: Language;
    learningLanguages: Language[];
    currentLevel: {
      [languageCode: string]: 'beginner' | 'intermediate' | 'advanced';
    };
  };
  
  export type ChatMessage = {
    id: string;
    content: {
      original: string;
      translated: string;
    };
    sender: 'user' | 'assistant';
    timestamp: number;
    isEdited: boolean;
  };
  
  export type Scenario = {
    id: string;
    title: string;
    description: string;
    category: 'shopping' | 'dining' | 'travel' | 'business' | 'casual';
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    persona: {
      name: string;
      role: string;
      personality: string;
      languageStyle: 'formal' | 'casual' | 'mixed';
    };
  };
  
  export type Session = {
    id: string;
    userId: string;
    scenarioId: string;
    targetLanguage: Language;
    sourceLanguage: Language;
    messages: ChatMessage[];
    startTime: number;
    lastUpdated: number;
  };