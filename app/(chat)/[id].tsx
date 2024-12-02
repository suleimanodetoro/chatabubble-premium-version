// app/(chat)/[id].tsx
import { View, StyleSheet, Platform } from 'react-native';
import { useCallback } from 'react';
import { FlashList } from '@shopify/flash-list';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { ChatInput } from '../../components/ui/ChatInput';
import { ChatBubble } from '../../components/ui/ChatBubble';
import { useChatContext } from '../../contexts/ChatContext';
import { BackButton } from '../../components/ui/BackButton';

export default function ChatScreen() {
  const { state } = useChatContext();
  const insets = useSafeAreaInsets();

  const renderItem = useCallback(({ item }) => (
    <ChatBubble message={item} />
  ), []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen 
        options={{
          headerShown: false,
        }} 
      />
      
      {/* Header */}
      <View style={styles.header}>
        <BackButton />
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