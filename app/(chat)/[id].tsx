// app/(chat)/[id].tsx
import { View, StyleSheet, Platform, Alert, AppState } from "react-native";
import { useCallback, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { ChatInput } from "@/components/ui/ChatInput";
import { useChatContext } from "@/contexts/ChatContext";
import { BackButton } from "@/components/ui/BackButton";
import { useAppStore } from "@/hooks/useAppStore";
import { ThemedText } from "@/components/ThemedText";
import { ChatMessages } from "@/components/ChatMessages";
import { SessionManager } from "@/lib/services/sessionManager";

const DEFAULT_LANGUAGE = {
  code: "en",
  name: "English",
  direction: "ltr",
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { state, dispatch } = useChatContext();
  const {
    currentSession,
    currentScenario,
    setCurrentSession,
    user
  } = useAppStore();
  const insets = useSafeAreaInsets();

  // Handle app state changes and cleanup
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (!currentSession || !state.messages.length) return;
      
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        SessionManager.handleSessionEnd(currentSession, state.messages)
          .catch(error => console.error('Session cleanup error:', error));
      }
    });

    return () => {
      subscription.remove();
      // Cleanup on component unmount
      if (currentSession && state.messages.length) {
        SessionManager.handleSessionEnd(currentSession, state.messages)
          .catch(error => console.error('Unmount cleanup error:', error));
      }
    };
  }, [currentSession, state.messages]);

  // Initial chat state loading
  useEffect(() => {
    async function loadChatState() {
      if (!id || !currentSession) return;

      try {
        dispatch({ type: 'SET_SESSION', payload: id as string });
        await SessionManager.loadSession(id as string, currentSession, dispatch);
      } catch (error) {
        console.error('Error loading chat state:', error);
        Alert.alert('Error', 'Failed to load chat history');
      }
    }
    loadChatState();
  }, [id]);

  // Handle back button
  const handleBack = useCallback(() => {
    if (!currentSession || !state.messages.length) {
      router.back();
      return;
    }

    // Auto-complete session if it has messages
    SessionManager.handleSessionEnd(currentSession, state.messages, true)
      .then(() => router.back())
      .catch(error => {
        console.error('Error ending session:', error);
        Alert.alert('Error', 'Failed to save chat progress');
      });
  }, [currentSession, state.messages, router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <BackButton onPress={handleBack} />
        <View style={styles.headerCenter}>
          {currentScenario && (
            <ThemedText style={styles.headerTitle}>
              {currentScenario.title}
            </ThemedText>
          )}
          {currentSession?.target_language && (
            <ThemedText style={styles.headerLanguage}>
              {currentSession.target_language.name}
            </ThemedText>
          )}
        </View>
      </View>

      {state.status !== "active" && (
        <View style={styles.statusBanner}>
          <ThemedText style={styles.statusText}>
            Chat session ended
          </ThemedText>
        </View>
      )}

      <View style={styles.content}>
        <ChatMessages />
        <View style={[styles.inputWrapper, { paddingBottom: insets.bottom }]}>
          <ChatInput
            sessionLanguage={currentSession?.target_language ?? null}
            disabled={state.status !== "active"}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
    backgroundColor: "#fff",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerButton: {
    padding: 8,
    marginLeft: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
  },
  headerLanguage: {
    fontSize: 14,
    opacity: 0.7,
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  inputWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  statusBanner: {
    backgroundColor: "#F8F9FA",
    padding: 8,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
  },
  statusText: {
    fontSize: 14,
    color: "#007AFF",
  },
});
