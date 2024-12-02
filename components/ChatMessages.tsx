// components/ChatMessages.tsx
import React, { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ChatBubble } from './ui/ChatBubble';
import { useChatContext } from '../contexts/ChatContext';

export const ChatMessages = memo(function ChatMessages() {
  const { state } = useChatContext();
  
  // Memoize data to prevent unnecessary re-renders
  const messages = useMemo(() => state.messages, [state.messages]);

  return (
    <View style={styles.container}>
      <FlashList
        data={messages}
        renderItem={({ item }) => (
          <ChatBubble 
            key={item.id}
            message={item}
          />
        )}
        estimatedItemSize={80}
        contentContainerStyle={styles.list}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
});