// @/lib/services/chat.ts
import { supabase } from '../supabase/client';
import { Session, ChatMessage } from '@/types';
import { EncryptionService } from './encryption';
import NetInfo from '@react-native-community/netinfo';

// Define a result type for service operations
export interface ChatServiceResult<T = any> {
    success: boolean;
    data?: T;
    error?: Error;
}

interface SessionMetrics {
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  duration: number; // in seconds
  startTime: string; // ISO string
  lastMessageTime: string; // ISO string
}

export class ChatService {
  private static REQUEST_TIMEOUT = 10000; // 10 seconds timeout for Supabase requests

  // Helper to check network connection
  private static async isNetworkConnected(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      // Check reachability as well for a more reliable check
      return state.isConnected === true && state.isInternetReachable !== false;
    } catch (error) {
      console.warn('ChatService: Error checking network:', error);
      return false;
    }
  }

  /**
   * Creates or updates a session in Supabase, including messages.
   * Handles encryption and network checks.
   * Returns ChatServiceResult indicating success or failure.
   */
  static async createOrUpdateSession(session: Session, messages: ChatMessage[]): Promise<ChatServiceResult<Session>> {
    const operation = `createOrUpdateSession (ID: ${session.id})`;
    console.log(`ChatService: Starting ${operation}`, { messageCount: messages.length });

    if (!session.userId) {
        return { success: false, error: new Error("User ID is missing in session.") };
    }
    if (!session.target_language) {
      // Attempt to fallback to scenario language if available
      if (session.scenario?.target_language) {
        session.target_language = session.scenario.target_language;
      } else {
        console.error(`ChatService: ${operation} failed - Missing target language.`);
        return { success: false, error: new Error("Target language is required for the session.") };
      }
    }

    // Check network connection first
    if (!(await this.isNetworkConnected())) {
      console.warn(`ChatService: ${operation} skipped - Network unavailable.`);
      // Return success: false but without error, as this is expected offline behavior handled by queueing
      return { success: false, error: new Error("Network unavailable") };
    }

    try {
      // Ensure encryption key exists, attempt recovery if needed
      await EncryptionService.ensureEncryptionKey(session.userId, session.userEmail || ''); // Assuming userEmail might be available

      // Encrypt messages before saving (if not already encrypted)
      let processedMessages = messages;
      try {
          processedMessages = await Promise.all(
            messages.map(async msg => {
              if (!EncryptionService.isEncryptedMessage(msg)) {
                return await EncryptionService.encryptChatMessage(msg, session.userId);
              }
              return msg; // Already encrypted
            })
          );
      } catch (encryptionError) {
          console.error(`ChatService: ${operation} - Encryption failed:`, encryptionError);
          // Decide: fail operation or save unencrypted? Failing is safer.
          return { success: false, error: new Error(`Encryption failed: ${encryptionError.message}`) };
      }

      const metrics = this.calculateMetrics(session, messages); // Calculate metrics based on original messages

      // Prepare session data for Supabase (ensure timestamps are ISO strings)
      const sessionDataForSupabase = {
        id: session.id,
        user_id: session.userId,
        scenario_id: session.scenarioId,
        messages: processedMessages, // Save encrypted messages
        source_language: session.source_language,
        target_language: session.target_language,
        status: session.status,
        metrics: metrics,
        updated_at: new Date().toISOString(),
        // Only set created_at if it's truly a new session or missing startTime
        created_at: session.startTime ? new Date(session.startTime).toISOString() : new Date().toISOString()
      };

      // Add timeout protection to Supabase request
      const timeoutPromise = new Promise<ChatServiceResult>((_, reject) => {
        setTimeout(() => reject(new Error(`Supabase request timed out after ${this.REQUEST_TIMEOUT / 1000}s`)), this.REQUEST_TIMEOUT);
      });

      const savePromise = supabase
        .from('chat_sessions')
        .upsert(sessionDataForSupabase)
        .select() // Select the upserted data
        .single(); // Expect a single row

      // Race the promises
      const { data, error } = await Promise.race([savePromise, timeoutPromise]) as { data: any, error: any };

      if (error) {
        console.error(`ChatService: ${operation} - Supabase error:`, error);
        return { success: false, error: new Error(`Supabase error: ${error.message}`) };
      }

      if (!data) {
         console.error(`ChatService: ${operation} - Supabase returned no data after upsert.`);
         return { success: false, error: new Error("Supabase returned no data after upsert.") };
      }

      console.log(`ChatService: Successfully completed ${operation} in Supabase.`);
      // Return the updated session data from Supabase
      // Note: Supabase might return slightly different structure, adapt if needed
      const savedSession: Session = {
          ...session, // Keep original structure where possible
          id: data.id,
          userId: data.user_id,
          messages: data.messages || [], // Use messages returned from DB
          status: data.status,
          lastUpdated: new Date(data.updated_at).getTime(),
          startTime: new Date(data.created_at).getTime(),
          metrics: data.metrics
      };
      return { success: true, data: savedSession };

    } catch (error) {
      console.error(`ChatService: Unexpected error during ${operation}:`, error);
      return { success: false, error: error instanceof Error ? error : new Error("An unknown error occurred") };
    }
  }

  /**
   * Marks a session as completed in Supabase and saves the final message state.
   * Handles encryption and network checks.
   * Returns ChatServiceResult indicating success or failure.
   */
  static async completeSession(sessionId: string, messages: ChatMessage[]): Promise<ChatServiceResult> {
    const operation = `completeSession (ID: ${sessionId})`;
    console.log(`ChatService: Starting ${operation}`, { messageCount: messages.length });

    // Need userId for encryption
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.id) {
        return { success: false, error: new Error("User not authenticated for completing session.") };
    }

    // Check network connection first
    if (!(await this.isNetworkConnected())) {
      console.warn(`ChatService: ${operation} skipped - Network unavailable.`);
      return { success: false, error: new Error("Network unavailable") };
    }

    try {
      // Encrypt messages before final save
      let processedMessages = messages;
      try {
          await EncryptionService.ensureEncryptionKey(user.id, user.email);
          processedMessages = await Promise.all(
            messages.map(async msg => {
              if (!EncryptionService.isEncryptedMessage(msg)) {
                return await EncryptionService.encryptChatMessage(msg, user.id);
              }
              return msg;
            })
          );
      } catch (encryptionError) {
           console.error(`ChatService: ${operation} - Encryption failed:`, encryptionError);
           return { success: false, error: new Error(`Encryption failed: ${encryptionError.message}`) };
      }

      // Ensure timestamps are ISO strings for Supabase
      const formattedMessages = processedMessages.map(msg => ({
        ...msg,
        timestamp: typeof msg.timestamp === 'number'
          ? new Date(msg.timestamp).toISOString()
          : msg.timestamp // Assume already ISO string if not number
      }));

      // Add timeout protection
      const timeoutPromise = new Promise<ChatServiceResult>((_, reject) => {
        setTimeout(() => reject(new Error(`Supabase request timed out after ${this.REQUEST_TIMEOUT / 1000}s`)), this.REQUEST_TIMEOUT);
      });

      const updatePromise = supabase
        .from('chat_sessions')
        .update({
          messages: formattedMessages, // Save final encrypted messages
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select('id') // Select only ID to confirm update
        .single();

      // Race the promises
      const { data, error } = await Promise.race([updatePromise, timeoutPromise]) as { data: any, error: any };

      if (error) {
        console.error(`ChatService: ${operation} - Supabase error:`, error);
        return { success: false, error: new Error(`Supabase error: ${error.message}`) };
      }

       if (!data) {
         console.error(`ChatService: ${operation} - Supabase returned no data after update.`);
         // This might happen if the session ID didn't exist, treat as error
         return { success: false, error: new Error("Session not found or update failed.") };
       }

      console.log(`ChatService: Successfully completed ${operation} in Supabase.`);
      return { success: true };

    } catch (error) {
      console.error(`ChatService: Unexpected error during ${operation}:`, error);
      return { success: false, error: error instanceof Error ? error : new Error("An unknown error occurred") };
    }
  }

  /**
   * Fetches a single session AND its messages from Supabase.
   * Returns the session object and messages array.
   * Handles network checks. Returns nulls if not found or error.
   */
  static async fetchSessionWithMessages(sessionId: string, userId: string): Promise<{session: Session | null, messages: ChatMessage[]}> {
     const operation = `fetchSessionWithMessages (ID: ${sessionId})`;
     console.log(`ChatService: Starting ${operation}`);

     if (!userId) {
         console.error(`ChatService: ${operation} failed - User ID is required.`);
         return { session: null, messages: [] };
     }

     // Check network connection first
     if (!(await this.isNetworkConnected())) {
       console.warn(`ChatService: ${operation} skipped - Network unavailable.`);
       return { session: null, messages: [] };
     }

     try {
       // Add timeout protection
       const timeoutPromise = new Promise<{ data: any, error: any }>((_, reject) => {
         setTimeout(() => reject(new Error(`Supabase request timed out after ${this.REQUEST_TIMEOUT / 1000}s`)), this.REQUEST_TIMEOUT);
       });

       const fetchPromise = supabase
         .from('chat_sessions')
         // Fetch all session fields AND the associated scenario details
         .select(`
            *,
            scenario:scenarios(*)
         `)
         .eq('id', sessionId)
         .eq('user_id', userId) // Ensure user owns the session
         .maybeSingle(); // Use maybeSingle to handle not found gracefully (returns null data)

       // Race the promises
       const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

       if (error) {
         console.error(`ChatService: ${operation} - Supabase error:`, error);
         // Don't throw, return nulls
         return { session: null, messages: [] };
       }

       if (!data) {
         console.log(`ChatService: ${operation} - Session not found in Supabase.`);
         return { session: null, messages: [] };
       }

       // Transform the Supabase response to our Session type
       const session: Session = {
         id: data.id,
         userId: data.user_id,
         scenarioId: data.scenario_id,
         source_language: data.source_language,
         target_language: data.target_language,
         startTime: data.created_at ? new Date(data.created_at).getTime() : Date.now(),
         lastUpdated: data.updated_at ? new Date(data.updated_at).getTime() : Date.now(),
         status: data.status,
         scenario: data.scenario, // Attach the fetched scenario object
         messages: [], // Messages are separate in the response but we'll return them separately
         metrics: data.metrics,
         userEmail: undefined // Add if needed later
       };

       // Extract messages (handle potential null or non-array)
       const messages = Array.isArray(data.messages) ? data.messages : [];

       console.log(`ChatService: Successfully completed ${operation}. Found ${messages.length} messages.`);
       return { session, messages };

     } catch (error) {
       console.error(`ChatService: Unexpected error during ${operation}:`, error);
       return { session: null, messages: [] }; // Return nulls on unexpected errors
     }
   }

  // --- Other methods (anonymizeSession, getSessionHistory) remain largely the same ---
  // Ensure they also implement robust network checks and potentially timeouts if needed.

  static async anonymizeSession(sessionId: string): Promise<boolean> {
    // ... (keep existing logic, ensure network check and timeout if necessary) ...
    // Add network check
    if (!(await this.isNetworkConnected())) {
        console.warn(`ChatService: Anonymize session ${sessionId} skipped - Network unavailable.`);
        return false;
    }
    // Consider adding timeout here as well
    // ... rest of the logic ...
    return true; // Placeholder
  }

  static async getSessionHistory(userId: string): Promise<any[]> {
     // ... (keep existing logic, ensure network check and timeout if necessary) ...
     // Add network check
     if (!(await this.isNetworkConnected())) {
         console.warn(`ChatService: Get session history for ${userId} skipped - Network unavailable.`);
         return [];
     }
     // Consider adding timeout here as well
     // ... rest of the logic ...
     return []; // Placeholder
   }


  // Calculate metrics helper - unchanged
  private static calculateMetrics(session: Session, messages: ChatMessage[]): SessionMetrics {
    const userMessages = messages.filter(m => m.sender === 'user');
    const assistantMessages = messages.filter(m => m.sender === 'assistant');
    // Ensure startTime is valid before calculating duration
    const startTimeMs = session.startTime || Date.now();
    const startTimeISO = new Date(startTimeMs).toISOString();
    const lastMessageTimeISO = new Date().toISOString(); // Use current time as last message time for calculation
    const durationSeconds = Math.floor((Date.now() - startTimeMs) / 1000);

    return {
      messageCount: messages.length,
      userMessageCount: userMessages.length,
      assistantMessageCount: assistantMessages.length,
      duration: durationSeconds,
      startTime: startTimeISO,
      lastMessageTime: lastMessageTimeISO
    };
  }
}
