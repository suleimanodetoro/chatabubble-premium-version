// components/ChatMessages.tsx
import React, { memo, useMemo,useEffect } from 'react';
import { StyleSheet, View, Platform} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { ChatBubble } from './ui/ChatBubble';
import { useChatContext } from '../contexts/ChatContext';

// components/ChatMessages.tsx
export const ChatMessages = memo(function ChatMessages() {
    const { state } = useChatContext();
    // Only log in development
  if (__DEV__) {
    console.log('ChatMessages - Messages count:', state.messages.length);
  }
    
    // Add debug logging
    useEffect(() => {
      console.log('ChatMessages - Messages count:', state.messages.length);
      console.log('ChatMessages - Messages:', state.messages);
    }, [state.messages]);
  
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
    paddingBottom: Platform.select({ ios: 100, android: 80 }), // Add this line
  },
});