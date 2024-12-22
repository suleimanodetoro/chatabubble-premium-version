// lib/services/sessionManager.ts
import { Session, ChatMessage } from '@/types';
import { supabase } from '../supabase/client';
import { StorageService } from './storage';
import { ChatService } from './chat';
import { EncryptionService } from './encryption';


export class SessionManager {
  private static debounceTimeout: NodeJS.Timeout | null = null;
  private static lastSyncTime: number = 0;
  private static SYNC_INTERVAL = 5000; // 5 seconds

  static async loadSession(
    sessionId: string, 
    currentSession: Session,
    dispatch: (action: any) => void
  ) {
    try {
      console.log('Loading session:', sessionId);
      
      // First load from local storage
      const messages = await StorageService.loadChatHistory(sessionId);
      
      if (Array.isArray(messages) && messages.length > 0) {
        try {
          // Decrypt messages before dispatching
          const decryptedMessages = await Promise.all(
            messages.map(async (msg) => {
              try {
                return await EncryptionService.decryptChatMessage(msg, currentSession.userId);
              } catch (decryptError) {
                console.error('Error decrypting message:', decryptError);
                // Return original message if decryption fails
                return msg;
              }
            })
          );
          
          console.log('Loaded and decrypted messages:', decryptedMessages.length);
          dispatch({ type: 'LOAD_MESSAGES', payload: decryptedMessages });
        } catch (decryptError) {
          console.error('Error during message decryption:', decryptError);
          // Fall back to original messages if decryption fails completely
          dispatch({ type: 'LOAD_MESSAGES', payload: messages });
        }
      }
  
      // Try to sync with Supabase if we have newer data
      const { data: remoteSession } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
  
      if (remoteSession) {
        const remoteTimestamp = new Date(remoteSession.updated_at).getTime();
        const localTimestamp = currentSession.lastUpdated || 0;
  
        if (remoteTimestamp > localTimestamp) {
          console.log('Remote session is newer, updating local');
          try {
            // Decrypt remote messages
            const decryptedRemoteMessages = await Promise.all(
              (remoteSession.messages || []).map(async (msg) => {
                try {
                  return await EncryptionService.decryptChatMessage(msg, currentSession.userId);
                } catch (decryptError) {
                  console.error('Error decrypting remote message:', decryptError);
                  return msg;
                }
              })
            );
            await this.handleSessionUpdate(currentSession, decryptedRemoteMessages);
            dispatch({ type: 'LOAD_MESSAGES', payload: decryptedRemoteMessages });
          } catch (error) {
            console.error('Error processing remote messages:', error);
            // Fall back to local messages if remote processing fails
          }
        }
      }
  
      return messages;
    } catch (error) {
      console.error('Error loading session:', error);
      throw error;
    }
  }
  // Add cleanup method
static async cleanup(userId: string) {
    try {
      await EncryptionService.removeEncryptionKey(userId);
      // Clear any cached sessions or state
      await StorageService.clearUserData(userId);
    } catch (error) {
      console.error('Session cleanup error:', error);
      throw error;
    }
  }

  static async handleSessionUpdate(session: Session, messages: ChatMessage[]) {
    try {
      console.log('Handling session update:', {
        sessionId: session.id,
        messageCount: messages.length
      });
  
      // Save unencrypted messages locally first
      await StorageService.saveChatHistory(session.id, messages);
  
      // Debounce Supabase updates
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }
  
      this.debounceTimeout = setTimeout(async () => {
        const now = Date.now();
        if (now - this.lastSyncTime >= this.SYNC_INTERVAL) {
          await this.syncToSupabase(session, messages);
          this.lastSyncTime = now;
        }
      }, 1000);
  
    } catch (error) {
      console.error('Session update error:', error);
      throw error;
    }
  }

  static async handleSessionEnd(
    session: Session, 
    messages: ChatMessage[], 
    autoComplete = false
  ) {
    try {
      console.log('Ending session:', {
        sessionId: session.id,
        messageCount: messages.length,
        autoComplete
      });

      // Clear any pending debounce
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }

      // Update session status if auto-completing
      const updatedSession = {
        ...session,
        messages,
        status: autoComplete ? 'completed' : session.status,
        lastUpdated: Date.now()
      };

      // Final save to both storages
      await Promise.all([
        StorageService.saveChatHistory(session.id, messages),
        ChatService.createOrUpdateSession(updatedSession, messages)
      ]);

    } catch (error) {
      console.error('Session end error:', error);
      throw error;
    }
  }

  private static async syncToSupabase(session: Session, messages: ChatMessage[]) {
    try {
      console.log('Syncing to Supabase:', {
        sessionId: session.id,
        messageCount: messages.length
      });

      await ChatService.createOrUpdateSession({
        ...session,
        messages,
        lastUpdated: Date.now()
      }, messages);

    } catch (error) {
      console.error('Supabase sync error:', error);
      // Will retry on next sync interval
    }
  }
}