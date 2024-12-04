// contexts/ChatContext.tsx
import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { ChatMessage } from '@/types';
import { StorageService } from '@/lib/services/storage';

type ChatState = {
  messages: ChatMessage[];
  isLoading: boolean;
  editingMessageId: string | null;
  sessionId: string | null;
};

type ChatAction =
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'UPDATE_MESSAGE'; payload: { id: string; message: Partial<ChatMessage> } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_EDITING'; payload: string | null }
  | { type: 'SET_SESSION'; payload: string }
  | { type: 'LOAD_MESSAGES'; payload: ChatMessage[] };

const initialState: ChatState = {
  messages: [],
  isLoading: false,
  editingMessageId: null,
  sessionId: null,
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

const ChatContext = createContext<{
  state: ChatState;
  dispatch: React.Dispatch<ChatAction>;
} | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialState);

  // Save messages whenever they change
  useEffect(() => {
    if (state.sessionId && state.messages.length > 0) {
      StorageService.saveChatHistory(state.sessionId, state.messages);
    }
  }, [state.messages, state.sessionId]);

  return (
    <ChatContext.Provider value={{ state, dispatch }}>
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