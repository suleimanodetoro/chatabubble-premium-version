// lib/services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage, Session } from '@/types';
import { SyncService } from './sync';

const CHAT_HISTORY_KEY = '@chat_history:';
const ACTIVE_SESSIONS_KEY = '@active_sessions:';
const MAX_LOCAL_SESSIONS = 10;
const MAX_CHUNK_SIZE = 512 * 1024; // 512KB chunks for iOS

export class StorageService {
  private static async saveWithChunking(key: string, value: string) {
    try {
      // If data is small enough, save directly
      if (value.length < MAX_CHUNK_SIZE) {
        await AsyncStorage.setItem(key, value);
        return;
      }

      // Split into chunks
      const chunks = Math.ceil(value.length / MAX_CHUNK_SIZE);
      const chunkPromises = [];

      for (let i = 0; i < chunks; i++) {
        const chunk = value.slice(i * MAX_CHUNK_SIZE, (i + 1) * MAX_CHUNK_SIZE);
        const chunkKey = `${key}_chunk_${i}`;
        chunkPromises.push(AsyncStorage.setItem(chunkKey, chunk));
      }

      // Save chunk metadata
      await Promise.all([
        ...chunkPromises,
        AsyncStorage.setItem(`${key}_chunks`, chunks.toString())
      ]);
    } catch (error) {
      console.error('Error in saveWithChunking:', error);
      throw error;
    }
  }

  private static async loadWithChunking(key: string): Promise<string | null> {
    try {
      // Check if data was chunked
      const chunksStr = await AsyncStorage.getItem(`${key}_chunks`);
      
      // If no chunks metadata, try regular load
      if (!chunksStr) {
        return AsyncStorage.getItem(key);
      }

      // Load all chunks
      const chunks = parseInt(chunksStr);
      const chunkPromises = [];

      for (let i = 0; i < chunks; i++) {
        const chunkKey = `${key}_chunk_${i}`;
        chunkPromises.push(AsyncStorage.getItem(chunkKey));
      }

      const loadedChunks = await Promise.all(chunkPromises);
      return loadedChunks.join('');
    } catch (error) {
      console.error('Error in loadWithChunking:', error);
      throw error;
    }
  }

  static async saveChatHistory(sessionId: string, messages: ChatMessage[]) {
    try {
      console.log('Saving chat history for session:', sessionId);
      const key = `${CHAT_HISTORY_KEY}${sessionId}`;
      const value = JSON.stringify(messages);
      await this.saveWithChunking(key, value);
      console.log('Chat history saved successfully');
    } catch (error) {
      console.error('Error saving chat history:', error);
      throw error;
    }
  }

  static async loadChatHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      const key = `${CHAT_HISTORY_KEY}${sessionId}`;
      const data = await this.loadWithChunking(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error loading chat history:', error);
      return []; // Return empty array instead of throwing
    }
  }

  static async saveSession(session: Session) {
    try {
      console.log('Starting to save session:', session.id);
      
      // Save session data
      const sessionKey = `${ACTIVE_SESSIONS_KEY}${session.id}`;
      const sessionData = JSON.stringify(session);
      await this.saveWithChunking(sessionKey, sessionData);
      
      // Save messages separately
      await this.saveChatHistory(session.id, session.messages);

      // Handle sync if needed
      if (session.status === 'completed' || session.status === 'saved') {
        await SyncService.syncChatSession(session);
      }

      await this.cleanupOldSessions();
      console.log('Session saved successfully');
    } catch (error) {
      console.error('Detailed save session error:', {
        error,
        sessionId: session.id,
        messageCount: session.messages?.length || 0
      });
      throw error;
    }
  }

  // Load a specific session
  static async loadSession(sessionId: string): Promise<Session | null> {
    try {
      const sessionKey = `${ACTIVE_SESSIONS_KEY}${sessionId}`;
      const sessionData = await AsyncStorage.getItem(sessionKey);
      
      if (!sessionData) return null;
      
      const session = JSON.parse(sessionData);
      // Load messages separately
      session.messages = await this.loadChatHistory(sessionId);
      
      return session;
    } catch (error) {
      console.error('Error loading session:', error);
      throw error;
    }
  }

  // Get all active sessions
  static async getActiveSessions(): Promise<Session[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(key => key.startsWith(ACTIVE_SESSIONS_KEY));
      
      const sessions = await Promise.all(
        sessionKeys.map(async key => {
          const sessionId = key.replace(ACTIVE_SESSIONS_KEY, '');
          return await this.loadSession(sessionId);
        })
      );

      return sessions.filter((session): session is Session => session !== null);
    } catch (error) {
      console.error('Error getting active sessions:', error);
      throw error;
    }
  }

  // Delete a session and its chat history
  static async deleteSession(sessionId: string) {
    try {
      const chatKey = `${CHAT_HISTORY_KEY}${sessionId}`;
      const sessionKey = `${ACTIVE_SESSIONS_KEY}${sessionId}`;
      
      await Promise.all([
        AsyncStorage.removeItem(chatKey),
        AsyncStorage.removeItem(sessionKey)
      ]);
      
      console.log('Session and chat history deleted for session:', sessionId);
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  // Private method to cleanup old sessions
  private static async cleanupOldSessions() {
    try {
      const activeSessions = await this.getActiveSessions();
      
      // If we have more than MAX_LOCAL_SESSIONS, remove the oldest ones
      if (activeSessions.length > MAX_LOCAL_SESSIONS) {
        const sortedSessions = activeSessions
          .filter(session => session.status === 'active')
          .sort((a, b) => b.lastUpdated - a.lastUpdated);
        
        const sessionsToRemove = sortedSessions.slice(MAX_LOCAL_SESSIONS);
        
        await Promise.all(
          sessionsToRemove.map(session => this.deleteSession(session.id))
        );
      }
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
    }
  }
  static async clearAll() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      await AsyncStorage.multiRemove(keys);
      console.log('All storage cleared');
    } catch (error) {
      console.error('Error clearing storage:', error);
      throw error;
    }
  }
}