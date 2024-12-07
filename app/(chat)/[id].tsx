// app/(chat)/[id].tsx
import { View, StyleSheet, Platform } from 'react-native';
import { useCallback, useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { ChatInput } from '../../components/ui/ChatInput';
import { ChatBubble } from '../../components/ui/ChatBubble';
import { useChatContext } from '../../contexts/ChatContext';
import { BackButton } from '../../components/ui/BackButton';
import { useAppStore } from '../../hooks/useAppStore';
import { StorageService } from '../../lib/services/storage';
import { ThemedText } from '../../components/ThemedText';

const DEFAULT_LANGUAGE = {
  code: 'en',
  name: 'English',
  direction: 'ltr'
};

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const { state, dispatch } = useChatContext();
  const { 
    currentSession, 
    currentScenario, 
    loadSession, 
    setCurrentSession, 
    setCurrentScenario 
  } = useAppStore();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    async function loadChatState() {
      if (id) {
        try {
          console.log('Loading chat state for ID:', id);
          
          // Load history
          const history = await StorageService.loadChatHistory(id as string);
          console.log('Loaded history:', history);
          
          if (history && history.length > 0) {
            dispatch({ type: 'LOAD_MESSAGES', payload: history });
          }

          // Load session if not already loaded
          if (!currentSession) {
            const savedSession = loadSession(id as string);
            if (savedSession) {
              console.log('Loaded session:', savedSession);
              setCurrentSession(savedSession);
              setCurrentScenario(savedSession.scenario);
            }
          }
        } catch (error) {
          console.error('Error loading chat state:', error);
        }
      }
    }
    loadChatState();
  }, [id, dispatch, currentSession, loadSession, setCurrentSession, setCurrentScenario]);

  const renderItem = useCallback(({ item }) => (
    <ChatBubble 
      message={item} 
      language={
        item.sender === 'assistant' 
          ? currentSession?.targetLanguage ?? DEFAULT_LANGUAGE 
          : DEFAULT_LANGUAGE
      }
    />
  ), [currentSession]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }} 
      />
      
      <View style={styles.header}>
        <BackButton />
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
      
      <View style={styles.content}>
        <FlashList
          data={state.messages}
          renderItem={renderItem}
          estimatedItemSize={80}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Platform.select({ ios: 100, android: 80 }) }
          ]}
          showsVerticalScrollIndicator={false}
        />
        
        <View style={[styles.inputWrapper, { paddingBottom: insets.bottom }]}>
          <ChatInput 
            sessionLanguage={currentSession?.targetLanguage ?? null}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 16,
    flex: 1,
  },
  headerLanguage: {
    fontSize: 14,
    opacity: 0.7,
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: 16,
  },
  inputWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#fff',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
});