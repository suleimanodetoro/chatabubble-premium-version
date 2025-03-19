// app/(chat)/[id].tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { 
  View, 
  StyleSheet, 
  Platform, 
  Alert, 
  AppState, 
  ActivityIndicator,
  FlatList,
  Pressable,
  TouchableOpacity
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { useChatContext } from "@/contexts/ChatContext";
import { useAppStore } from "@/hooks/useAppStore";
import { SessionManager } from "@/lib/services/sessionManager";
import { useTheme } from "@/lib/theme/theme";
import { Heading3, Body1, Body2, Caption } from "@/components/ui/Typography";
import { Button } from "@/components/ui/Button";
import { ChatBubble } from "@/components/ui/ChatBubble";
import { Feather } from '@expo/vector-icons';
import Animated, { 
  FadeIn, 
  FadeOut, 
  SlideInUp,
  useAnimatedStyle,
  useSharedValue,
  withTiming
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

// Enhanced chat input with animations and better UX
const ChatInput = ({ 
  onSend, 
  disabled = false, 
  loading = false,
  targetLanguageName = ""
}: { 
  onSend: (text: string) => void; 
  disabled?: boolean;
  loading?: boolean;
  targetLanguageName?: string;
}) => {
  const [text, setText] = useState("");
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<any>(null);

  const handleSend = () => {
    if (!text.trim() || disabled || loading) return;
    
    onSend(text.trim());
    setText("");
  };

  return (
    <View style={[
      styles.inputContainer,
      { paddingBottom: Math.max(insets.bottom, 12) }
    ]}>
      {/* Language indicator */}
      {targetLanguageName && (
        <View style={styles.languageIndicator}>
          <Feather name="globe" size={12} color={theme.colors.text.secondary} />
          <Caption color={theme.colors.text.secondary}>
            Speaking in {targetLanguageName}
          </Caption>
        </View>
      )}
      
      <View style={styles.inputRow}>
        <View style={[
          styles.textInputContainer,
          disabled && styles.disabledInput
        ]}>
          <Animated.TextInput
            ref={inputRef}
            style={styles.textInput}
            placeholder={disabled ? "Chat session ended" : "Type a message..."}
            placeholderTextColor={theme.colors.text.hint}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            editable={!disabled && !loading}
          />
          
          {/* Voice input button (not functional yet, just UI) */}
          <TouchableOpacity 
            style={styles.voiceButton}
            disabled={disabled || loading}
          >
            <Feather 
              name="mic" 
              size={20} 
              color={disabled ? theme.colors.text.disabled : theme.colors.primary.main} 
            />
          </TouchableOpacity>
        </View>
        
        <Button
          variant="primary"
          icon="send"
          size="medium"
          style={styles.sendButton}
          disabled={!text.trim() || disabled || loading}
          onPress={handleSend}
          loading={loading}
        />
      </View>
    </View>
  );
};

// Animated header for the chat screen
const ChatHeader = ({ 
  title,
  subtitle,
  onBack,
  onInfo
}: {
  title: string;
  subtitle?: string;
  onBack: () => void;
  onInfo?: () => void;
}) => {
  const theme = useTheme();
  const scrollY = useSharedValue(0);
  const insets = useSafeAreaInsets();
  
  const headerStyle = useAnimatedStyle(() => {
    return {
      height: withTiming(scrollY.value > 50 ? 60 + insets.top : 80 + insets.top),
      opacity: withTiming(1),
      paddingTop: insets.top,
    };
  });

  const subtitleStyle = useAnimatedStyle(() => {
    return {
      opacity: withTiming(scrollY.value > 30 ? 0 : 1),
      height: withTiming(scrollY.value > 30 ? 0 : 20),
    };
  });

  return (
    <Animated.View style={[styles.header, headerStyle]}>
      <BlurView
        style={StyleSheet.absoluteFill}
        tint="light"
        intensity={95}
      />
      <View style={styles.headerContent}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
        >
          <Feather name="chevron-left" size={24} color={theme.colors.primary.main} />
        </TouchableOpacity>
        
        <View style={styles.headerTitleContainer}>
          <Heading3 
            numberOfLines={1} 
            style={styles.headerTitle}
          >
            {title}
          </Heading3>
          
          <Animated.View style={subtitleStyle}>
            <Body2 
              color={theme.colors.text.secondary}
              numberOfLines={1}
            >
              {subtitle}
            </Body2>
          </Animated.View>
        </View>
        
        {onInfo && (
          <TouchableOpacity
            style={styles.infoButton}
            onPress={onInfo}
          >
            <Feather name="info" size={20} color={theme.colors.primary.main} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

// Scenario info modal component
const ScenarioInfoCard = ({ 
  scenario, 
  isVisible, 
  onClose 
}: { 
  scenario: any; 
  isVisible: boolean; 
  onClose: () => void;
}) => {
  const theme = useTheme();
  
  if (!isVisible) return null;
  
  return (
    <Animated.View
      style={[styles.infoCardContainer]}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
    >
      <BlurView
        style={StyleSheet.absoluteFill}
        tint="dark"
        intensity={20}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
        />
      </BlurView>
      
      <Animated.View 
        style={styles.infoCard}
        entering={SlideInUp.springify()}
      >
        <View style={styles.infoCardHandle} />
        
        <Heading3 style={styles.infoCardTitle}>{scenario.title}</Heading3>
        <Body1 style={styles.infoCardDescription}>{scenario.description}</Body1>
        
        <View style={styles.personaSection}>
          <Heading3 style={styles.sectionTitle}>Conversation Partner</Heading3>
          
          <View style={styles.personaContainer}>
            <View style={styles.personaAvatar}>
              <Feather name="user" size={24} color="#fff" />
            </View>
            <View style={styles.personaDetails}>
              <Body1 weight="semibold">{scenario.persona.name}</Body1>
              <Body2 color={theme.colors.text.secondary}>{scenario.persona.role}</Body2>
            </View>
          </View>
          
          <Body1 style={styles.personalityText}>{scenario.persona.personality}</Body1>
          
          <View style={styles.infoTags}>
            <View style={styles.infoTag}>
              <Caption>Style: </Caption>
              <Caption weight="semibold">{scenario.persona.languageStyle}</Caption>
            </View>
            
            <View style={styles.infoTag}>
              <Caption>Difficulty: </Caption>
              <Caption weight="semibold">{scenario.difficulty}</Caption>
            </View>
            
            <View style={styles.infoTag}>
              <Caption>Language: </Caption>
              <Caption weight="semibold">{scenario.target_language.name}</Caption>
            </View>
          </View>
        </View>
        
        <Button
          variant="primary"
          style={styles.closeButton}
          onPress={onClose}
        >
          Close
        </Button>
      </Animated.View>
    </Animated.View>
  );
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { state, dispatch } = useChatContext();
  const {
    currentSession,
    currentScenario,
    setCurrentSession,
  } = useAppStore();
  const [showInfo, setShowInfo] = useState(false);
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const listRef = useRef<FlatList>(null);
  const scrollY = useSharedValue(0);
  const headerHeight = 80 + insets.top;

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

  // Auto scroll to bottom when new messages arrive
  useEffect(() => {
    if (state.messages.length > 0 && listRef.current) {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [state.messages.length]);

  // Handle ending the chat
  const handleEndChat = useCallback(() => {
    Alert.alert(
      "End Conversation",
      "Are you sure you want to end this conversation?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "End",
          style: "destructive",
          onPress: async () => {
            try {
              await SessionManager.handleSessionEnd(
                currentSession!, 
                state.messages, 
                true
              );
              dispatch({ type: 'SET_STATUS', payload: 'completed' });
              router.back();
            } catch (error) {
              console.error('Error ending session:', error);
              Alert.alert('Error', 'Failed to end conversation');
            }
          }
        }
      ]
    );
  }, [currentSession, state.messages]);

  // Handle back button
  const handleBack = useCallback(() => {
    if (!currentSession || !state.messages.length) {
      router.back();
      return;
    }

    Alert.alert(
      "Leave Conversation",
      "Do you want to save and continue later, or end this conversation?",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Save & Continue Later",
          onPress: async () => {
            try {
              await SessionManager.handleSessionEnd(
                currentSession, 
                state.messages, 
                false
              );
              router.back();
            } catch (error) {
              console.error('Error saving session:', error);
              Alert.alert('Error', 'Failed to save conversation');
            }
          }
        },
        {
          text: "End Conversation",
          style: "destructive",
          onPress: async () => {
            try {
              await SessionManager.handleSessionEnd(
                currentSession, 
                state.messages, 
                true
              );
              router.back();
            } catch (error) {
              console.error('Error ending session:', error);
              Alert.alert('Error', 'Failed to end conversation');
            }
          }
        }
      ]
    );
  }, [currentSession, state.messages, router]);

  // Handle sending a message
  const handleSend = useCallback(async (text: string) => {
    if (!currentSession || !currentScenario || !text.trim() || state.isLoading) return;
    
    try {
      // Create a new message
      const newMessage = {
        id: Date.now().toString(),
        content: {
          original: text,
          translated: 'Translating...',
        },
        sender: 'user' as const,
        timestamp: Date.now(),
        isEdited: false,
      };
      
      // Add to context
      dispatch({ type: 'ADD_MESSAGE', payload: newMessage });
      dispatch({ type: 'SET_LOADING', payload: true });
      
      // The ChatBubble component and contexts will handle the rest
      // (translation, AI response, storage, etc.)
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Failed to send message');
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }, [currentSession, currentScenario, state.isLoading]);

  // Render a loading view if needed
  if (!currentSession || !currentScenario) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary.main} />
        <Body1 style={{ marginTop: 20 }}>Loading conversation...</Body1>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: false,
        }}
      />

      {/* Header */}
      <ChatHeader
        title={currentScenario.title}
        subtitle={currentSession.target_language.name}
        onBack={handleBack}
        onInfo={() => setShowInfo(true)}
      />

      {/* Status Banner */}
      {state.status !== "active" && (
        <View style={styles.statusBanner}>
          <ThemedText style={styles.statusText}>
            Conversation Ended
          </ThemedText>
          <Button
            variant="primary"
            size="small"
            onPress={() => router.replace("/(tabs)/scenarios")}
          >
            Start New
          </Button>
        </View>
      )}

      {/* Messages List */}
      <FlatList
        ref={listRef}
        data={state.messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ChatBubble message={item} />
        )}
        contentContainerStyle={[
          styles.messagesList,
          { paddingTop: headerHeight } // Account for absolute header
        ]}
        onScroll={(event) => {
          scrollY.value = event.nativeEvent.contentOffset.y;
        }}
        scrollEventThrottle={16}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <View style={styles.emptyIconContainer}>
              <Feather name="message-circle" size={40} color={theme.colors.text.hint} />
            </View>
            <Body1 color={theme.colors.text.secondary} style={styles.emptyChatText}>
              Start the conversation by sending a message
            </Body1>
          </View>
        }
      />

      {/* Input Area */}
      <View style={styles.inputWrapper}>
        <ChatInput
          onSend={handleSend}
          disabled={state.status !== "active"}
          loading={state.isLoading}
          targetLanguageName={currentSession.target_language.name}
        />
      </View>

      {/* End Chat Button */}
      {state.status === 'active' && state.messages.length > 0 && (
        <TouchableOpacity 
          style={[styles.endChatButton, { bottom: 80 + insets.bottom }]}
          onPress={handleEndChat}
        >
          <Body2 color={theme.colors.error.main}>End Conversation</Body2>
        </TouchableOpacity>
      )}

      {/* Scenario Info Modal */}
      <ScenarioInfoCard
        scenario={currentScenario}
        isVisible={showInfo}
        onClose={() => setShowInfo(false)}
      />
    </View>
  );
}

// Import this here to avoid potential circular dependencies
import { ThemedText } from "@/components/ThemedText";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerTitle: {
    textAlign: 'center',
  },
  infoButton: {
    padding: 8,
    marginLeft: 8,
  },
  statusBanner: {
    position: 'absolute',
    top: 100,
    left: 16,
    right: 16,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 12,
    zIndex: 5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statusText: {
    color: '#B91C1C',
    fontSize: 14,
    fontWeight: '500',
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  emptyChat: {
    marginTop: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyChatText: {
    textAlign: 'center',
    maxWidth: 250,
  },
  inputWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  languageIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  textInputContainer: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  disabledInput: {
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    paddingTop: 4,
    paddingBottom: 4,
    maxHeight: 100,
  },
  voiceButton: {
    padding: 6,
    marginBottom: 2,
    marginLeft: 4,
  },
  sendButton: {
    borderRadius: 20,
    width: 40,
    height: 40,
    padding: 0,
  },
  endChatButton: {
    position: 'absolute',
    right: 16,
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  infoCardContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    zIndex: 20,
  },
  infoCard: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
    maxHeight: '80%',
  },
  infoCardHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#CBD5E1',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  infoCardTitle: {
    marginBottom: 8,
  },
  infoCardDescription: {
    marginBottom: 24,
    opacity: 0.8,
  },
  sectionTitle: {
    marginBottom: 12,
    fontSize: 18,
  },
  personaSection: {
    marginBottom: 24,
  },
  personaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  personaAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#4A6FFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  personaDetails: {
    flex: 1,
  },
  personalityText: {
    marginBottom: 16,
  },
  infoTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  infoTag: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  closeButton: {
    alignSelf: 'center',
    minWidth: 120,
  },
});