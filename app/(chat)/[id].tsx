// app/(chat)/[id].tsx
import { View, StyleSheet, Platform, Pressable } from "react-native";
import { useCallback, useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FlashList } from "@shopify/flash-list";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { ChatInput } from "@/components/ui/ChatInput";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { useChatContext } from "@/contexts/ChatContext";
import { BackButton } from "@/components/ui/BackButton";
import { useAppStore } from "@/hooks/useAppStore";
import { ThemedText } from "@/components/ThemedText";
import { Feather } from "@expo/vector-icons";
import { StorageService } from "@/lib/services/storage";

const DEFAULT_LANGUAGE = {
  code: "en",
  name: "English",
  direction: "ltr",
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { state, dispatch, completeSession, saveSession } = useChatContext();
  const {
    currentSession,
    currentScenario,
    loadSession,
    setCurrentSession,
    setCurrentScenario,
  } = useAppStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    async function loadChatState() {
      if (id) {
        try {
          console.log('Loading chat state for ID:', id);
          dispatch({ type: 'SET_SESSION', payload: id as string });
          
          // Load both history and session
          const [history, savedSession] = await Promise.all([
            StorageService.loadChatHistory(id as string),
            loadSession(id as string)
          ]);
  
          // Set messages if we have them
          if (history.length > 0) {
            console.log('Loaded history:', history);
            dispatch({ type: 'LOAD_MESSAGES', payload: history });
          }
          
          // Set session if we have it
          if (savedSession && !currentSession) {
            console.log('Loaded session:', savedSession);
            setCurrentSession(savedSession);
            setCurrentScenario(savedSession.scenario);
          }
        } catch (error) {
          console.error('Error loading chat state:', error);
        }
      }
    }
    loadChatState();
  }, [id]);  // Remove other dependencies to prevent reloading

  const handleComplete = async () => {
    try {
      await completeSession();
      router.back();
    } catch (error) {
      console.error("Error completing session:", error);
    }
  };

  const handleSave = async () => {
    try {
      await saveSession();
      router.back();
    } catch (error) {
      console.error("Error saving session:", error);
    }
  };

  const renderItem = useCallback(
    ({ item }) => (
      <ChatBubble
        message={item}
        language={
          item.sender === "assistant"
            ? currentSession?.targetLanguage ?? DEFAULT_LANGUAGE
            : DEFAULT_LANGUAGE
        }
      />
    ),
    [currentSession]
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      <View style={styles.header}>
        <BackButton />
        <View style={styles.headerCenter}>
          {currentScenario && (
            <ThemedText style={styles.headerTitle}>
              {currentScenario.title}
            </ThemedText>
          )}
          {currentSession?.targetLanguage && (
            <ThemedText style={styles.headerLanguage}>
              {currentSession.targetLanguage.name}
            </ThemedText>
          )}
        </View>
        <View style={styles.headerRight}>
          <Pressable style={styles.headerButton} onPress={handleSave}>
            <Feather name="bookmark" size={20} color="#007AFF" />
          </Pressable>
          <Pressable style={styles.headerButton} onPress={handleComplete}>
            <Feather name="check-circle" size={20} color="#007AFF" />
          </Pressable>
        </View>
      </View>

      {state.status !== "active" && (
        <View style={styles.statusBanner}>
          <ThemedText style={styles.statusText}>
            {state.status === "completed"
              ? "Session Completed"
              : "Session Saved"}
          </ThemedText>
        </View>
      )}

      <View style={styles.content}>
        <FlashList
          data={state.messages}
          renderItem={renderItem}
          estimatedItemSize={80}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.select({ ios: 100, android: 80 }) },
          ]}
          showsVerticalScrollIndicator={false}
        />

        <View style={[styles.inputWrapper, { paddingBottom: insets.bottom }]}>
          <ChatInput
            sessionLanguage={currentSession?.targetLanguage ?? null}
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
