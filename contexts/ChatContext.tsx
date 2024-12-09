// contexts/ChatContext.tsx
import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { ChatMessage, Session } from '@/types';
import { StorageService } from '@/lib/services/storage';
import { SyncService } from '@/lib/services/sync';
import { MetricsService } from '@/lib/services/metrics';
import { useAppStore } from '@/hooks/useAppStore';

type ChatState = {
  messages: ChatMessage[];
  isLoading: boolean;
  editingMessageId: string | null;
  sessionId: string | null;
  status: 'active' | 'completed' | 'saved';
};

type ChatAction =
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; message: Partial<ChatMessage> } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_EDITING'; payload: string | null }
  | { type: 'SET_SESSION'; payload: string }
  | { type: 'SET_STATUS'; payload: 'active' | 'completed' | 'saved' }
  | { type: 'LOAD_MESSAGES'; payload: ChatMessage[] };

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  editingMessageId: null,
  sessionId: null,
  status: 'active',
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        messages: state.messages.map(msg =>
          msg.id === action.payload.id
            ? { ...msg, ...action.payload.message }
            : msg
        ),
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.payload,
      };
    case 'SET_EDITING':
      return {
        ...state,
        editingMessageId: action.payload,
      };
    case 'SET_SESSION':
      return {
        ...state,
        sessionId: action.payload,
        status: 'active',
      };
    case 'SET_STATUS':
      return {
        ...state,
        status: action.payload,
      };
    case 'LOAD_MESSAGES':
      return {
        ...state,
        messages: action.payload,
      };
    default:
      return state;
  }
}

interface ChatContextValue {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  completeSession: () => Promise<void>;
  saveSession: () => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);
  
  const { 
    user,
    currentSession, 
    currentScenario,
    sourceLanguage,
    targetLanguage,
    setCurrentSession,
  } = useAppStore();

  // Primary effect for saving messages - keep this simple and reliable
  useEffect(() => {
    if (state.sessionId && state.messages.length > 0) {
      StorageService.saveChatHistory(state.sessionId, state.messages)
        .catch(error => console.error('Error saving chat history:', error));
    }
  }, [state.messages, state.sessionId]);

  // Separate effect for session management
  useEffect(() => {
    if (!state.sessionId || !currentScenario || !state.messages.length) return;

    const updateSession = async () => {
      try {
        const session: Session = {
          id: state.sessionId,
          userId: user?.id || 'guest',
          scenarioId: currentScenario.id,
          sourceLanguage: sourceLanguage || { code: 'en', name: 'English', direction: 'ltr' },
          targetLanguage: targetLanguage || currentScenario.targetLanguage,
          messages: state.messages,
          startTime: currentSession?.startTime || Date.now(),
          lastUpdated: Date.now(),
          status: state.status,
          scenario: currentScenario,
          metrics: {
            messageCount: state.messages.length,
            duration: Date.now() - (currentSession?.startTime || Date.now()),
          },
        };
        
        await StorageService.saveSession(session);
        setCurrentSession(session);
      } catch (error) {
        console.error('Error updating session:', error);
      }
    };

    updateSession();
  }, [state.status, state.sessionId]);

  const completeSession = async () => {
    if (!state.sessionId || !currentScenario) return;

    try {
      dispatch({ type: 'SET_STATUS', payload: 'completed' });
      
      const session: Session = {
        id: state.sessionId,
        userId: user?.id || 'guest',
        scenarioId: currentScenario.id,
        sourceLanguage: sourceLanguage || { code: 'en', name: 'English', direction: 'ltr' },
        targetLanguage: targetLanguage || currentScenario.targetLanguage,
        messages: state.messages,
        startTime: currentSession?.startTime || Date.now(),
        lastUpdated: Date.now(),
        status: 'completed',
        scenario: currentScenario,
        metrics: {
          messageCount: state.messages.length,
          duration: Date.now() - (currentSession?.startTime || Date.now()),
        },
      };

      await StorageService.saveSession(session);
      await SyncService.syncChatSession(session).catch(e => console.error('Sync error:', e));
      await MetricsService.updateSessionMetrics(session).catch(e => console.error('Metrics error:', e));
      setCurrentSession(session);
    } catch (error) {
      console.error('Error completing session:', error);
      // Revert status if completion fails
      dispatch({ type: 'SET_STATUS', payload: 'active' });
    }
  };

  const saveSession = async () => {
    if (!state.sessionId || !currentScenario) return;

    try {
      dispatch({ type: 'SET_STATUS', payload: 'saved' });
      
      const session: Session = {
        id: state.sessionId,
        userId: user?.id || 'guest',
        scenarioId: currentScenario.id,
        sourceLanguage: sourceLanguage || { code: 'en', name: 'English', direction: 'ltr' },
        targetLanguage: targetLanguage || currentScenario.targetLanguage,
        messages: state.messages,
        startTime: currentSession?.startTime || Date.now(),
        lastUpdated: Date.now(),
        status: 'saved',
        scenario: currentScenario,
        metrics: {
          messageCount: state.messages.length,
          duration: Date.now() - (currentSession?.startTime || Date.now()),
        },
      };

      await StorageService.saveSession(session);
      await SyncService.syncChatSession(session).catch(e => console.error('Sync error:', e));
      setCurrentSession(session);
    } catch (error) {
      console.error('Error saving session:', error);
      // Revert status if save fails
      dispatch({ type: 'SET_STATUS', payload: 'active' });
    }
  };

  return (
    <ChatContext.Provider value={{ state, dispatch, completeSession, saveSession }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}