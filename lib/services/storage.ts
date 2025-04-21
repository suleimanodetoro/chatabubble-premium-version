// lib/services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ChatMessage, Session } from '@/types';
import { SyncService } from './sync';

const CHAT_HISTORY_KEY = '@chat_history:';
const ACTIVE_SESSIONS_KEY = '@active_sessions:';
const MAX_LOCAL_SESSIONS = 10;
const MAX_CHUNK_SIZE = 512 * 1024; // 512KB chunks for iOS

export class StorageService {
  // Make these public so they can be accessed from other services
  static readonly CHAT_HISTORY_KEY = CHAT_HISTORY_KEY;
  static readonly ACTIVE_SESSIONS_KEY = ACTIVE_SESSIONS_KEY;
  
  static async saveWithChunking(key: string, value: string) {
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
  
  static async clearUserData(userId: string) {
    try {
      // Get all keys
      const keys = await AsyncStorage.getAllKeys();
      
      // Filter keys related to user data
      const userKeys = keys.filter(key => 
        key.includes(`${CHAT_HISTORY_KEY}${userId}`) ||
        key.includes(`${ACTIVE_SESSIONS_KEY}${userId}`) ||
        key.includes(`@encryption_key_${userId}`) ||
        key.includes(`_chunk_`)  // Also clean up any chunk data
      );
      
      // Remove all user related data
      if (userKeys.length > 0) {
        await AsyncStorage.multiRemove(userKeys);
        console.log(`Cleared ${userKeys.length} user data keys for ${userId}`);
      }
    } catch (error) {
      console.error('Error clearing user data:', error);
      throw error;
    }
  }

  static async loadWithChunking(key: string): Promise<string | null> {
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
      
      // Filter out any null chunks
      const validChunks = loadedChunks.filter(chunk => chunk !== null);
      
      // If we got at least one chunk, return the joined content
      if (validChunks.length > 0) {
        return validChunks.join('');
      }
      
      // If all chunks failed, try the regular key one last time
      return AsyncStorage.getItem(key);
    } catch (error) {
      console.error('Error in loadWithChunking:', error);
      throw error;
    }
  }

  static async saveChatHistory(sessionId: string, messages: ChatMessage[], shouldAutoEncrypt = true) {
    try {
      console.log('Saving chat history for session:', sessionId, {
        messageCount: messages.length,
        shouldAutoEncrypt
      });
      
      // Add an indicator property to track if messages have been processed/saved correctly
      const messagesWithMetadata = messages.map(msg => ({
        ...msg,
        _savedAt: Date.now(),
        _encryptionStatus: shouldAutoEncrypt ? 'encrypted' : 'plaintext'
      }));
      
      const key = `${CHAT_HISTORY_KEY}${sessionId}`;
      const value = JSON.stringify(messagesWithMetadata);
      await this.saveWithChunking(key, value);
      console.log('Chat history saved successfully');
      
      // Create a message count marker key to help detect missing messages
      await AsyncStorage.setItem(`${CHAT_HISTORY_KEY}${sessionId}_count`, messages.length.toString());
    } catch (error) {
      console.error('Error saving chat history:', error);
      throw error;
    }
  }

  static async loadChatHistory(sessionId: string): Promise<ChatMessage[]> {
    try {
      console.log(`Loading chat history for session: ${sessionId}`);
      const key = `${CHAT_HISTORY_KEY}${sessionId}`;
      const data = await this.loadWithChunking(key);
      
      if (!data) {
        console.log(`No chat history found for session: ${sessionId}`);
        return [];
      }
      
      try {
        // Parse messages and remove any metadata properties we might have added
        const parsedMessages = JSON.parse(data);
        
        // Check if the data is valid
        if (!Array.isArray(parsedMessages)) {
          console.error(`Invalid message data format for session ${sessionId}, not an array`);
          return [];
        }
        
        // Clear any metadata when returning
        const cleanMessages = parsedMessages.map((msg: any) => {
          // Create a clean copy without metadata fields
          const { _savedAt, _encryptionStatus, ...cleanMessage } = msg;
          return cleanMessage;
        });
        
        console.log(`Successfully loaded ${cleanMessages.length} messages for session ${sessionId}`);
        return cleanMessages;
      } catch (parseError) {
        console.error(`Error parsing message data for session ${sessionId}:`, parseError);
        return [];
      }
    } catch (error) {
      console.error('Error loading chat history:', error);
      return []; // Return empty array instead of throwing
    }
  }

  // NEW: Method to save only session metadata without messages
  static async saveSessionMetadata(session: Session) {
    try {
      console.log(`Saving session metadata for ${session.id}`);
      
      // Make a copy of the session without messages
      const sessionWithoutMessages = {
        ...session,
        messages: [], // Don't store messages in session metadata
        lastUpdated: Date.now(),
        _messageCount: Array.isArray(session.messages) ? session.messages.length : 0 // Add metadata about message count
      };
      
      // Save session data
      const sessionKey = `${ACTIVE_SESSIONS_KEY}${session.id}`;
      const sessionData = JSON.stringify(sessionWithoutMessages);
      await this.saveWithChunking(sessionKey, sessionData);
      
      console.log(`Session metadata saved successfully for ${session.id}`);
      return true;
    } catch (error) {
      console.error(`Error saving session metadata for ${session.id}:`, error);
      return false;
    }
  }

  static async saveSession(session: Session) {
    try {
      console.log('Starting to save session:', session.id);
      console.log('SaveSession called with messages:', session.messages?.length);
      
      // FIXED: Keep a reference to messages but don't include them in session storage
      const messages = session.messages || [];
      
      // Save session metadata
      await this.saveSessionMetadata(session);
      
      // Save messages separately without auto-encryption
      // This prevents double encryption by ensuring encryption happens only once
      if (messages.length > 0) {
        await this.saveChatHistory(session.id, messages, false);
      }

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
      const sessionData = await this.loadWithChunking(sessionKey);
      
      if (!sessionData) {
        console.log(`No session metadata found for ${sessionId}`);
        return null;
      }
      
      try {
        // Parse the session data
        const session = JSON.parse(sessionData);
        
        // Load messages separately
        const messages = await this.loadChatHistory(sessionId);
        
        // Check message count
        const expectedMessageCount = session._messageCount || 0;
        console.log(`Loaded ${messages.length} of ${expectedMessageCount} expected messages for session ${sessionId}`);
        
        // Combine session metadata with messages
        return {
          ...session,
          messages
        };
      } catch (parseError) {
        console.error(`Error parsing session data for ${sessionId}:`, parseError);
        return null;
      }
    } catch (error) {
      console.error('Error loading session:', error);
      throw error;
    }
  }

  // Get all active sessions
  static async getActiveSessions(): Promise<Session[]> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(key => key.startsWith(ACTIVE_SESSIONS_KEY) && !key.includes('_chunk_') && !key.includes('_chunks'));
      
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
      // Get all storage keys that might be related to this session
      const keys = await AsyncStorage.getAllKeys();
      const sessionRelatedKeys = keys.filter(key => 
        key === `${CHAT_HISTORY_KEY}${sessionId}` || 
        key === `${ACTIVE_SESSIONS_KEY}${sessionId}` ||
        key.startsWith(`${CHAT_HISTORY_KEY}${sessionId}_chunk_`) ||
        key.startsWith(`${ACTIVE_SESSIONS_KEY}${sessionId}_chunk_`) ||
        key === `${CHAT_HISTORY_KEY}${sessionId}_chunks` ||
        key === `${ACTIVE_SESSIONS_KEY}${sessionId}_chunks` ||
        key === `${CHAT_HISTORY_KEY}${sessionId}_count`
      );
      
      // Delete all related keys
      if (sessionRelatedKeys.length > 0) {
        await AsyncStorage.multiRemove(sessionRelatedKeys);
      }
      
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