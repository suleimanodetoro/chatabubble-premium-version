// contexts/ChatContext.tsx
import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { ChatMessage, Session } from '@/types';
import { StorageService } from '@/lib/services/storage';
import { SyncService } from '@/lib/services/sync';
import { MetricsService } from '@/lib/services/metrics';
import { useAppStore } from '@/hooks/useAppStore';
import { supabase } from '@/lib/supabase/client';
import NetInfo from '@react-native-community/netinfo';
import { ProfileService } from '@/lib/services/profile';
import { SessionManager } from '@/lib/services/sessionManager';



type ChatState = {
  messages: ChatMessage[];
  isLoading: boolean;
  editingMessageId: string | null;
  sessionId: string | null;
  status: 'active' | 'completed' | 'saved';
  syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
};

type ChatAction =
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; message: Partial<ChatMessage> } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_EDITING'; payload: string | null }
  | { type: 'SET_SESSION'; payload: string }
  | { type: 'SET_STATUS'; payload: 'active' | 'completed' | 'saved' }
  | { type: 'LOAD_MESSAGES'; payload: ChatMessage[] }
  | { type: 'SYNC_STATUS'; payload: 'idle' | 'syncing' | 'synced' | 'error' };

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  editingMessageId: null,
  sessionId: null,
  status: 'active',
  syncStatus: 'idle',
};

const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
    switch (action.type) {
      case 'ADD_MESSAGE':
        const newMessages = [...state.messages, action.payload];
        return {
          ...state,
          messages: newMessages,
        };
  
      case 'UPDATE_MESSAGE':
        const messageIndex = state.messages.findIndex(msg => msg.id === action.payload.id);
        if (messageIndex === -1) return state;
      
        const updatedMessages = state.messages.slice(0, messageIndex + 1).map(msg =>
          msg.id === action.payload.id
            ? { ...msg, ...action.payload.message }
            : msg
        );
      
        return {
          ...state,
          messages: updatedMessages,
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

    case 'SYNC_STATUS':
      return {
        ...state,
        syncStatus: action.payload
      };

    default:
      return state;
  }
};

interface ChatContextValue {
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
  completeSession: () => Promise<void>;
  saveSession: () => Promise<void>;
  syncStatus: ChatState['syncStatus'];
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

  // Network status effect
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && currentSession?.status !== 'active') {
        syncWithSupabase();
      }
    });

    return () => unsubscribe();
  }, [currentSession]);

  // Realtime subscription effect
  useEffect(() => {
    if (!user?.id) return;

    const subscription = supabase
      .channel('chat_updates')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'chat_sessions',
        filter: `user_id=eq.${user.id}`
      }, async (payload) => {
        if (payload.new.id === state.sessionId) {
          await handleRemoteUpdate(payload.new as Session);
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [user?.id, state.sessionId]);

  const handleRemoteUpdate = async (remoteSession: Session) => {
    const localSession = await StorageService.loadSession(remoteSession.id);
    
    if (!localSession || remoteSession.lastUpdated > localSession.lastUpdated) {
      await StorageService.saveSession(remoteSession);
      dispatch({ type: 'LOAD_MESSAGES', payload: remoteSession.messages });
      setCurrentSession(remoteSession);
    }
  };

  const syncWithSupabase = async () => {
    if (!state.sessionId || !currentSession) return;

    try {
      dispatch({ type: 'SYNC_STATUS', payload: 'syncing' });
      await SyncService.syncChatSession(currentSession);
      dispatch({ type: 'SYNC_STATUS', payload: 'synced' });
    } catch (error) {
      console.error('Sync error:', error);
      dispatch({ type: 'SYNC_STATUS', payload: 'error' });
    }
  };

  const completeSession = async () => {
    if (!state.sessionId || !currentScenario || !state.messages.length) return;
  
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
        scenario: currentScenario
      };
  
      // Save locally first
      await StorageService.saveSession(session);
  
      // Only sync with Supabase if we have a real user
      if (user?.id) {
        console.log('Syncing completed session to Supabase:', {
          sessionId: session.id,
          messageCount: session.messages.length
        });
        
        await ChatService.completeSession(session.id, session.messages);
        
        // Update metrics after successful Supabase sync
        await MetricsService.updateSessionMetrics(session);
        
        // Check if level up is needed
        const stats = await MetricsService.getUserMetrics(user.id);
        const currentProgress = stats.languageProgress[session.targetLanguage.code];
        
        if (currentProgress?.sessionsCompleted % 5 === 0) {
          await ProfileService.updateProfile(user.id, {
            current_levels: {
              ...user.current_levels,
              [session.targetLanguage.code]: currentProgress.sessionsCompleted > 20 ? 'advanced' :
                                          currentProgress.sessionsCompleted > 10 ? 'intermediate' : 
                                          'beginner'
            }
          });
        }
      }
  
      setCurrentSession(session);
    } catch (error) {
      console.error('Error completing session:', error);
      dispatch({ type: 'SET_STATUS', payload: 'active' });
      throw error; // Important: Throw the error so handleComplete can show the alert
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
      await syncWithSupabase();
      setCurrentSession(session);
    } catch (error) {
      console.error('Error saving session:', error);
      dispatch({ type: 'SET_STATUS', payload: 'active' });
    }
  };

  // Effect for session management
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

  return (
    <ChatContext.Provider value={{ 
      state, 
      dispatch, 
      completeSession, 
      saveSession,
      syncStatus: state.syncStatus 
    }}>
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