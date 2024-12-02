// components/ui/ChatBubble.tsx
import React, { memo, useCallback } from 'react';
import { StyleSheet, View, Pressable, Alert } from 'react-native';
import { ThemedText } from '../ThemedText';
import { useThemeColor } from '@/hooks/useThemeColor';
import { ChatMessage } from '@/types';
import { useChatContext } from '../../contexts/ChatContext';
import { OpenAIService } from '../../lib/services/openai';
import { useAppStore } from '../../hooks/useAppStore';

interface ChatBubbleProps {
  message: ChatMessage;
}

export const ChatBubble = memo(function ChatBubble({ message }: ChatBubbleProps) {
  const { dispatch } = useChatContext();
  const { targetLanguage } = useAppStore();
  const isUser = message.sender === 'user';

  const backgroundColor = useThemeColor(
    { light: isUser ? '#007AFF' : '#E9ECEF', dark: isUser ? '#0A84FF' : '#2C2C2E' },
    'background'
  );

  const textColor = useThemeColor(
    { light: isUser ? '#FFFFFF' : '#000000', dark: '#FFFFFF' },
    'text'
  );

  // Updated handleEdit function in ChatBubble
const handleEdit = async (editType: 'original' | 'translation') => {
    if (!targetLanguage) return;
  
    const textToEdit = editType === 'original' 
      ? message.content.original 
      : message.content.translated;
  
    // Use Alert.prompt only once and handle the result
    Alert.prompt(
      'Edit Message',
      `Edit ${editType === 'original' ? 'message' : 'translation'}:`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {}
        },
        {
          text: 'Save',
          onPress: async (newText?: string) => {
            if (!newText?.trim()) return;
            
            dispatch({ type: 'SET_LOADING', payload: true });
            
            try {
              const translationResult = await OpenAIService.translateText(
                newText,
                editType === 'original' 
                  ? targetLanguage.name 
                  : 'English'
              );
  
              dispatch({
                type: 'UPDATE_MESSAGE',
                payload: {
                  id: message.id,
                  message: {
                    content: {
                      original: editType === 'original' ? newText : translationResult,
                      translated: editType === 'original' ? translationResult : newText
                    },
                    isEdited: true
                  }
                }
              });
            } catch (error) {
              Alert.alert('Error', 'Failed to save edit');
            } finally {
              dispatch({ type: 'SET_LOADING', payload: false });
            }
          }
        }
      ],
      'plain-text',
      textToEdit
    );
  };
  const handleLongPress = useCallback(() => {
    Alert.alert(
      'Edit Message',
      'What would you like to edit?',
      [
        {
          text: isUser ? 'Edit My Message' : 'Edit Original Text',
          onPress: () => handleEdit('original')
        },
        {
          text: isUser ? 'Edit Translation' : 'Edit English Translation',
          onPress: () => handleEdit('translation')
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  }, [handleEdit, isUser]);

  return (
    <Pressable onLongPress={handleLongPress}>
      <View
        style={[
          styles.container,
          isUser ? styles.userContainer : styles.assistantContainer,
          { backgroundColor }
        ]}
      >
        <ThemedText style={[styles.originalText, { color: textColor }]}>
          {message.content.original}
        </ThemedText>
        <ThemedText style={[styles.translatedText, { color: textColor, opacity: 0.8 }]}>
          {message.content.translated}
        </ThemedText>
        {message.isEdited && (
          <ThemedText style={[styles.editedText, { color: textColor, opacity: 0.6 }]}>
            edited
          </ThemedText>
        )}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  container: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4,
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  assistantContainer: {
    alignSelf: 'flex-start',
  },
  originalText: {
    fontSize: 16,
    marginBottom: 4,
  },
  translatedText: {
    fontSize: 14,
  },
  editedText: {
    fontSize: 12,
    marginTop: 4,
  },
  editContainer: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
    margin: 5,
  },
  editInput: {
    backgroundColor: '#fff',
    padding: 10,
    borderRadius: 5,
    minHeight: 40,
  },
  editButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 10,
  },
  editButton: {
    padding: 8,
  },
});
