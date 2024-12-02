// app/(chat)/[id].tsx
import { View, StyleSheet, Platform, Pressable } from 'react-native';
import { useCallback } from 'react';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ChatInput } from '../../components/ui/ChatInput';
import { ChatBubble } from '../../components/ui/ChatBubble';
import { useChatContext } from '../../contexts/ChatContext';

export default function ChatScreen() {
  const { state } = useChatContext();
  const insets = useSafeAreaInsets();

  const renderItem = useCallback(({ item }) => (
    <ChatBubble message={item} />
  ), []);

  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }} 
      />
      
      <View style={[styles.header, { paddingTop: insets.top }]}>
        <Pressable 
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Feather name="arrow-left" size={24} color="#007AFF" />
        </Pressable>
      </View>
      
      <View style={[styles.content, { paddingBottom: insets.bottom }]}>
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
          <ChatInput />
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
  backButton: {
    padding: 8,
    marginLeft: -8,
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