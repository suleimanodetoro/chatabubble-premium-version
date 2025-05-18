// contexts/ChatContext.tsx
import {
    createContext,
    useContext,
    useReducer,
    useEffect,
    ReactNode,
    useCallback,
    useMemo,
} from "react";
import { ChatMessage, Session } from "@/types";
import { StorageService } from "@/lib/services/storage";
import { SyncService } from "@/lib/services/sync";
import { MetricsService } from "@/lib/services/metrics";
import { useAppStore } from "@/hooks/useAppStore";
import { supabase } from "@/lib/supabase/client";
import NetInfo from "@react-native-community/netinfo";
import { ProfileService } from "@/lib/services/profile";
import { SessionManager } from "@/lib/services/sessionManager";
import { ChatService } from "@/lib/services/chat";


type ChatState = {
    messages: ChatMessage[];
    isLoading: boolean;
    editingMessageId: string | null;
    sessionId: string | null;
    status: "active" | "completed" | "saved";
    syncStatus: "idle" | "syncing" | "synced" | "error";
};

type ChatAction =
    | { type: "ADD_MESSAGE"; payload: ChatMessage }
    | { type: "UPDATE_MESSAGE"; payload: { id: string; message: Partial<ChatMessage> } }
    | { type: "SET_LOADING"; payload: boolean }
    | { type: "SET_EDITING"; payload: string | null }
    | { type: "SET_SESSION"; payload: string }
    | { type: "SET_STATUS"; payload: "active" | "completed" | "saved" }
    | { type: "LOAD_MESSAGES"; payload: ChatMessage[] }
    | { type: "SYNC_STATUS"; payload: "idle" | "syncing" | "synced" | "error" };

const initialState: ChatState = {
    messages: [],
    isLoading: false,
    editingMessageId: null,
    sessionId: null,
    status: "active",
    syncStatus: "idle",
};

// Keep chatReducer as it was, with the UPDATE_MESSAGE fix
const chatReducer = (state: ChatState, action: ChatAction): ChatState => {
    console.log(
    `DEBUG: chatReducer - Action Type: ${action.type}`,
    action.payload ? `Payload Keys: ${Object.keys(action.payload).join(", ")}` : ""
    );
    switch (action.type) {
    case "ADD_MESSAGE":
        return { ...state, messages: [...state.messages, action.payload] };
    case "UPDATE_MESSAGE":
        // CORRECTED: Map over the entire messages array to update the specific message
        return {
            ...state,
            messages: state.messages.map(msg =>
                msg.id === action.payload.id
                    ? { ...msg, ...action.payload.message }
                    : msg
            ),
        };
    case "SET_LOADING":
        return { ...state, isLoading: action.payload };
    case "SET_EDITING":
        return { ...state, editingMessageId: action.payload };
    case "SET_SESSION":
        return { ...state, sessionId: action.payload, status: "active" }; // Assuming SET_SESSION implies active
    case "SET_STATUS":
        return { ...state, status: action.payload };
    case "LOAD_MESSAGES":
        return { ...state, messages: action.payload };
    case "SYNC_STATUS":
        return { ...state, syncStatus: action.payload };
    default:
        return state;
    }
};

interface ChatContextValue {
    state: ChatState;
    dispatch: React.Dispatch<ChatAction>;
    completeSession: () => Promise<void>;
    saveSession: () => Promise<void>;
    syncStatus: ChatState["syncStatus"];
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
    console.log("DEBUG: ChatProvider mounting (Restored useReducer)...");

    const [state, dispatch] = useReducer(chatReducer, initialState);

    const {
        user,
        currentSession,
        currentScenario,
        source_language,
        target_language,
        setCurrentSession,
    } = useAppStore();
    console.log("DEBUG: ChatProvider - Reading from useAppStore:", { hasUser: !!user });

    const syncWithSupabase = useCallback(async () => {
        if (!state.sessionId || !currentSession) {
            console.log("Sync skipped: missing session ID or currentSession", { sid: state.sessionId, cs: !!currentSession });
            return;
        }
        console.log(`Attempting sync for session: ${state.sessionId}`);
        try {
            dispatch({ type: "SYNC_STATUS", payload: "syncing" });
            await SyncService.syncChatSession(currentSession);
            dispatch({ type: "SYNC_STATUS", payload: "synced" });
        } catch (error) {
            console.error("Sync error:", error);
            dispatch({ type: "SYNC_STATUS", payload: "error" });
        }
    }, [state.sessionId, currentSession, dispatch]);

    const handleRemoteUpdate = useCallback(async (remoteSession: Session) => {
         const localSession = await StorageService.loadSession(remoteSession.id);
         if (!localSession || remoteSession.lastUpdated > localSession.lastUpdated) {
             console.log("Handling remote update for session:", remoteSession.id);
             await StorageService.saveSession(remoteSession);
             if (state.sessionId === remoteSession.id) {
                 dispatch({ type: "LOAD_MESSAGES", payload: remoteSession.messages });
                 if (remoteSession.status !== state.status) {
                     dispatch({ type: "SET_STATUS", payload: remoteSession.status });
                 }
                 setCurrentSession(remoteSession);
             }
         }
    }, [state.sessionId, state.status, setCurrentSession, dispatch]);


    useEffect(() => {
        console.log("DEBUG: ChatProvider - Realtime effect triggered (body disabled).");
        /*
        // Realtime logic remains commented out
        */
        return () => {
            console.log("DEBUG: ChatProvider - Realtime effect cleanup (dummy - body disabled).");
        };
    }, [user?.id, state.sessionId, handleRemoteUpdate]);


    useEffect(() => {
        console.log("DEBUG: ChatProvider - Network effect triggered (body disabled).");
        /*
        // Network logic remains commented out
         */
         return () => {
            console.log("DEBUG: ChatProvider - Network effect cleanup (dummy - body disabled).");
         };
    }, [state.sessionId, state.status, syncWithSupabase]);

    const completeSession = useCallback(async () => {
         if (!state.sessionId || !currentScenario || !state.messages.length || !user?.id) return;
         const sessionStartTime = currentSession?.startTime || Date.now();
         try {
             dispatch({ type: "SET_STATUS", payload: "completed" });
             const session: Session = {
                 id: state.sessionId, userId: user.id, scenarioId: currentScenario.id,
                 source_language: source_language || { code: "en", name: "English", direction: "ltr" },
                 target_language: target_language || currentScenario.target_language,
                 messages: state.messages, startTime: sessionStartTime, lastUpdated: Date.now(),
                 status: "completed", scenario: currentScenario,
             };
             await SessionManager.handleSessionEnd(session, state.messages, true, false);
             setCurrentSession(session);
         } catch (error) {
             console.error("Error completing session:", error);
             if (state.sessionId) dispatch({ type: "SET_STATUS", payload: "active" });
             throw error;
         }
    }, [state.sessionId, currentScenario, state.messages, user?.id, source_language, target_language, currentSession?.startTime, setCurrentSession, dispatch]);

    const saveSession = useCallback(async () => {
         if (!state.sessionId || !currentScenario) return;
         const sessionStartTime = currentSession?.startTime || Date.now();
         try {
             dispatch({ type: "SET_STATUS", payload: "saved" });
             const session: Session = {
                 id: state.sessionId, userId: user?.id || "guest", scenarioId: currentScenario.id,
                 source_language: source_language || { code: "en", name: "English", direction: "ltr" },
                 target_language: target_language || currentScenario.target_language,
                 messages: state.messages, startTime: sessionStartTime, lastUpdated: Date.now(),
                 status: "saved", scenario: currentScenario,
                 metrics: { messageCount: state.messages.length, duration: Date.now() - sessionStartTime },
             };
             await SessionManager.handleSessionEnd(session, state.messages, false, false);
             setCurrentSession(session);
         } catch (error) {
             console.error("Error saving session:", error);
             if (state.sessionId) dispatch({ type: "SET_STATUS", payload: "active" });
         }
    }, [state.sessionId, currentScenario, state.messages, user?.id, source_language, target_language, currentSession?.startTime, syncWithSupabase, setCurrentSession, dispatch]);

    const contextValue = useMemo(() => ({
        state,
        dispatch,
        completeSession,
        saveSession,
        syncStatus: state.syncStatus,
    }), [state, dispatch, completeSession, saveSession]);

    console.log("DEBUG: ChatProvider rendering children (Restored useReducer)...");
    return (
        <ChatContext.Provider value={contextValue}>
            {children}
        </ChatContext.Provider>
    );
}

export function useChatContext() {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error("useChatContext must be used within a ChatProvider");
    }
    return context;
}
