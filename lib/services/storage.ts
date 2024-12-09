// lib/services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage, Session } from '@/types';
import { SyncService } from './sync';

const CHAT_HISTORY_KEY = '@chat_history:';
const ACTIVE_SESSIONS_KEY = '@active_sessions:';
const MAX_LOCAL_SESSIONS = 10;

export class StorageService {
  // Save chat messages for a session
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

  // Load chat messages for a session
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

  // Save entire session data
  static async saveSession(session: Session) {
    try {
      // Save to local storage
      const sessionKey = `${ACTIVE_SESSIONS_KEY}${session.id}`;
      await AsyncStorage.setItem(sessionKey, JSON.stringify(session));

      // Also save messages separately for quick access
      await this.saveChatHistory(session.id, session.messages);

      // If session is completed or saved, sync to Supabase
      if (session.status === 'completed' || session.status === 'saved') {
        await SyncService.syncChatSession(session);
      }

      // Cleanup old sessions if needed
      await this.cleanupOldSessions();
    } catch (error) {
      console.error('Error saving session:', error);
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
}