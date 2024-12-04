// lib/services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage } from '@/types';

const CHAT_HISTORY_KEY = '@chat_history:';

export class StorageService {
  static async saveChatHistory(sessionId: string, messages: ChatMessage[]) {
    try {
      const key = `${CHAT_HISTORY_KEY}${sessionId}`;
      await AsyncStorage.setItem(key, JSON.stringify(messages));
      console.log('Chat history saved for session:', sessionId);
    } catch (error) {
      console.error('Error saving chat history:', error);
      throw error;
    }
  }

  static async loadChatHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      const key = `${CHAT_HISTORY_KEY}${sessionId}`;
      const history = await AsyncStorage.getItem(key);
      return history ? JSON.parse(history) : [];
    } catch (error) {
      console.error('Error loading chat history:', error);
      throw error;
    }
  }

  static async deleteChatHistory(sessionId: string) {
    try {
      const key = `${CHAT_HISTORY_KEY}${sessionId}`;
      await AsyncStorage.removeItem(key);
      console.log('Chat history deleted for session:', sessionId);
    } catch (error) {
      console.error('Error deleting chat history:', error);
      throw error;
    }
  }

  static async getAllChatSessions(): Promise<string[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return keys.filter(key => key.startsWith(CHAT_HISTORY_KEY));
    } catch (error) {
      console.error('Error getting chat sessions:', error);
      throw error;
    }
  }
}