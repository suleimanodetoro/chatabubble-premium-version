// lib/services/sessionManager.ts
import { Session, ChatMessage } from '@/types';
import { supabase } from '../supabase/client';
import { StorageService } from './storage';
import { ChatService } from './chat';
import { EncryptionService } from './encryption';
import NetInfo from '@react-native-community/netinfo';

export class SessionManager {
  private static debounceTimeout: NodeJS.Timeout | null = null;
  private static lastSyncTime: number = 0;
  private static SYNC_INTERVAL = 5000; // 5 seconds

  // Helper to check network connection
  private static async isNetworkConnected(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected === true;
    } catch (error) {
      console.log('Error checking network:', error);
      return false;
    }
  }

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
          // Get current user for better error recovery
          const { data: { user } } = await supabase.auth.getUser();
          
          // Decrypt messages before dispatching
          const decryptedMessages = await Promise.all(
            messages.map(async (msg) => {
              try {
                return await EncryptionService.decryptChatMessage(msg, currentSession.userId);
              } catch (decryptError) {
                console.error('Error decrypting message:', decryptError);
                
                // If decryption fails and we have a user, try key recovery
                if (user && user.email) {
                  try {
                    // Attempt key recovery
                    const recoverySuccess = await EncryptionService.attemptKeyRecovery(
                      user.id, 
                      user.email
                    );
                    
                    if (recoverySuccess) {
                      // Try decryption again with recovered key
                      try {
                        return await EncryptionService.decryptChatMessage(msg, user.id);
                      } catch (secondError) {
                        console.error('Decryption failed even after key recovery:', secondError);
                      }
                    }
                  } catch (recoveryError) {
                    console.error('Error during key recovery:', recoveryError);
                  }
                }
                
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
  
      // Only try to sync with Supabase if network is available
      if (await this.isNetworkConnected()) {
        try {
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
        } catch (error) {
          console.log('Error syncing with Supabase (offline or API error):', error);
          // Continue with local data
        }
      } else {
        console.log('Network unavailable, using local data only');
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
  
      // Always save to local storage first, regardless of network state
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Ensure we have a valid encryption key
          const key = await EncryptionService.getEncryptionKey(user.id);
          if (!key) {
            // Attempt recovery if no key
            await EncryptionService.attemptKeyRecovery(user.id, user.email || '');
          }
          
          // Encrypt messages if possible
          const encryptedMessages = await Promise.all(
            messages.map(msg => EncryptionService.encryptChatMessage(msg, user.id))
          );
          
          // Save encrypted messages to local storage
          await StorageService.saveChatHistory(session.id, encryptedMessages);
        } else {
          // Save unencrypted if no user (shouldn't happen)
          await StorageService.saveChatHistory(session.id, messages);
        }
      } catch (encryptError) {
        console.error('Error encrypting messages:', encryptError);
        // Fall back to saving unencrypted if encryption fails
        await StorageService.saveChatHistory(session.id, messages);
      }
  
      // Debounce Supabase updates
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }
  
      this.debounceTimeout = setTimeout(async () => {
        const now = Date.now();
        if (now - this.lastSyncTime >= this.SYNC_INTERVAL) {
          try {
            // Only attempt server sync if network is available
            if (await this.isNetworkConnected()) {
              await this.syncToSupabase(session, messages);
            } else {
              console.log('Network unavailable, skipping Supabase sync');
            }
          } catch (error) {
            console.error('Error in sync operation:', error);
            // Don't propagate the error - we've already saved locally
          }
          this.lastSyncTime = now;
        }
      }, 1000);
  
    } catch (error) {
      console.error('Session update error:', error);
      // Don't throw the error since local storage succeeded
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

      // Always save to local storage first
      try {
        // Try to encrypt and save locally
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Check for encryption key and attempt recovery if needed
          const key = await EncryptionService.getEncryptionKey(user.id);
          if (!key && user.email) {
            await EncryptionService.attemptKeyRecovery(user.id, user.email);
          }
          
          // Encrypt messages
          const encryptedMessages = await Promise.all(
            messages.map(msg => EncryptionService.encryptChatMessage(msg, user.id))
          );
          
          // Save encrypted messages to local storage
          await StorageService.saveChatHistory(session.id, encryptedMessages);
          
          // Only try to save to Supabase if network is available
          if (await this.isNetworkConnected()) {
            try {
              if (autoComplete) {
                await ChatService.completeSession(session.id, encryptedMessages);
              } else {
                await ChatService.createOrUpdateSession({
                  ...updatedSession,
                  messages: encryptedMessages
                }, encryptedMessages);
              }
            } catch (serverError) {
              console.log('Error saving to server (will retry later):', serverError);
            }
          } else {
            console.log('Network unavailable, session saved locally only');
          }
          
          return;
        }
      } catch (error) {
        console.error('Error encrypting messages for session end:', error);
      }
      
      // Fallback to unencrypted save if encryption fails
      await StorageService.saveChatHistory(session.id, messages);
      
      // Try to save to server but don't fail if network is down
      if (await this.isNetworkConnected()) {
        try {
          if (autoComplete) {
            await ChatService.completeSession(session.id, messages);
          } else {
            await ChatService.createOrUpdateSession(updatedSession, messages);
          }
        } catch (serverError) {
          console.log('Error saving to server:', serverError);
        }
      }

    } catch (error) {
      console.error('Session end error:', error);
      // Don't propagate the error since critical operations were already handled
    }
  }

  private static async syncToSupabase(session: Session, messages: ChatMessage[]) {
    try {
      console.log('Attempting to sync to Supabase:', {
        sessionId: session.id,
        messageCount: messages.length
      });

      // Don't attempt sync if network is down
      if (!(await this.isNetworkConnected())) {
        console.log('Network unavailable, skipping sync');
        return;
      }

      const updatedSession = {
        ...session,
        messages,
        lastUpdated: Date.now()
      };

      await ChatService.createOrUpdateSession(updatedSession, messages);
      console.log('Successfully synced to Supabase');

    } catch (error) {
      console.error('Supabase sync error:', error);
      // Don't propagate the error - we'll retry later
    }
  }
}