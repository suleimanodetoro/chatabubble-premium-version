// app/(chat)/[id].tsx
import { View, StyleSheet, Platform, Pressable, Alert } from "react-native";
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessages } from "@/components/ChatMessages";

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

          // Load the session first
          const savedSession = await loadSession(id as string);

          if (savedSession) {
            console.log('Loaded session:', savedSession);
            setCurrentSession(savedSession);
            setCurrentScenario(savedSession.scenario);

            // Important: Load the messages from the session itself
            if (savedSession.messages && savedSession.messages.length > 0) {
              console.log('Loading messages from session:', savedSession.messages.length);
              dispatch({ type: 'LOAD_MESSAGES', payload: savedSession.messages });
              return; // Exit early as we have messages
            }
          }

          // Fallback: Try loading messages directly from storage
          const history = await StorageService.loadChatHistory(id as string);
          if (history.length > 0) {
            console.log('Loaded history from storage:', history.length);
            dispatch({ type: 'LOAD_MESSAGES', payload: history });
          }

        } catch (error) {
          console.error('Error loading chat state:', error);
        }
      }
    }
    loadChatState();
  }, [id]);

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

  const debugStorage = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      console.log('=== Storage Debug Start ===');
      console.log('All keys:', keys);

      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        console.log('\nKey:', key);
        console.log('Has value:', !!value);
        if (value && (key.includes('chat') || key.includes('session'))) {
          console.log('Content:', JSON.parse(value));
        }
      }
      console.log('=== Storage Debug End ===');

      Alert.alert('Debug Info', 'Check console for storage details');
    } catch (error) {
      console.error('Storage debug error:', error);
      Alert.alert('Debug Error', error.message);
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
          {__DEV__ && (
            <Pressable 
              style={styles.headerButton} 
              onPress={debugStorage}
            >
              <Feather name="settings" size={20} color="#FF3B30" />
            </Pressable>
          )}
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
        <ChatMessages />
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
