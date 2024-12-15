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
import { ChatService } from "@/lib/services/chat";
import { supabase } from "@/lib/supabase/client";



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
    user
  } = useAppStore();
  const insets = useSafeAreaInsets();
  const checkSessionStorage = async () => {
    if (!currentSession?.id) return;
    
    // Check local storage
    const localMessages = await StorageService.loadChatHistory(currentSession.id);
    console.log('Local storage messages:', {
      count: localMessages.length,
      messages: localMessages
    });
    
    // Check Supabase if user is logged in
    if (user?.id) {
      const { data } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', currentSession.id)
        .single();
        
      console.log('Supabase storage:', {
        exists: !!data,
        messageCount: data?.messages?.length,
        messages: data?.messages
      });
    }
  };

  const checkSyncStatus = async () => {
    if (!currentSession?.id) return;
    
    const { data, error } = await supabase
      .from('chat_sessions')
      .select('*')
      .eq('id', currentSession.id)
      .single();
  
    console.log('Supabase session status:', {
      exists: !!data,
      messageCount: data?.messages?.length,
      status: data?.status,
      error: error?.message
    });
  };

  useEffect(() => {
    async function loadChatState() {
      if (id && currentSession) {
        try {
          console.log('Loading chat state for ID:', id);
          dispatch({ type: 'SET_SESSION', payload: id as string });
          
          // First load messages from local storage
          const messages = await StorageService.loadChatHistory(id as string);
          if (messages.length > 0) {
            dispatch({ type: 'LOAD_MESSAGES', payload: messages });
          }
          
          // Then try to sync with Supabase
          const savedSession = await ChatService.createOrUpdateSession(
            {
              ...currentSession,
              messages
            },
            messages
          );
  
          if (savedSession) {
            setCurrentSession({
              ...currentSession,
              ...savedSession,
              messages
            });
          }
        } catch (error) {
          console.error('Error loading chat state:', error);
        }
      }
    }
    loadChatState();
  }, [id]); 
  // In [id].tsx, add this useEffect
useEffect(() => {
    async function debugMessages() {
      if (id) {
        console.log('=== DEBUG MESSAGES START ===');
        // Check AsyncStorage directly
        const chatKey = `@chat_history:${id}`;
        const data = await AsyncStorage.getItem(chatKey);
        console.log('Raw chat history:', data);
        
        // Check via StorageService
        const messages = await StorageService.loadChatHistory(id as string);
        console.log('StorageService messages:', messages);
  
        // Check Supabase
        const { data: sessionData } = await supabase
          .from('chat_sessions')
          .select('*')
          .eq('id', id)
          .single();
        console.log('Supabase session:', sessionData);
        console.log('=== DEBUG MESSAGES END ===');
      }
    }
    debugMessages();
  }, [id]);

  const handleComplete = async () => {
    try {
      if (!currentSession || !state.messages.length) return;
      await completeSession(); // Use the one from ChatContext
      router.back();
    } catch (error) {
      console.error("Error completing session:", error);
      Alert.alert('Error', 'Failed to complete session');
    }
  };

  const handleSave = async () => {
    try {
      if (!currentSession || !state.messages.length) return;
      
      await ChatService.createOrUpdateSession(currentSession, state.messages);
      dispatch({ type: 'SET_STATUS', payload: 'saved' });
      router.back();
    } catch (error) {
      console.error("Error saving session:", error);
      Alert.alert('Error', 'Failed to save session');
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
    onPress={checkSessionStorage}
  >
    <Feather name="info" size={20} color="#FF3B30" />
  </Pressable>
)}
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
          
          <Pressable style={styles.headerButton} onPress={async () => {
  await handleComplete();
  await checkSyncStatus();
}}>
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
