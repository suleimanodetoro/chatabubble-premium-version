// @/lib/services/chat.ts

import { supabase } from '../supabase/client';
import { Session, ChatMessage } from '@/types';
import { EncryptionService } from './encryption';
import NetInfo from '@react-native-community/netinfo';

interface SessionMetrics {
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  duration: number;
  startTime: string;
  lastMessageTime: string;
}

export class ChatService {
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

  static async createOrUpdateSession(session: Session, messages: ChatMessage[]) {
    try {
      // Check network connection first
      if (!(await this.isNetworkConnected())) {
        console.log('Network unavailable, skipping server update');
        return null; // Return null instead of throwing when offline
      }

      console.log('Starting session save:', {
        sessionId: session.id,
        userId: session.userId,
        messageCount: messages.length
      });
  
      if (!session.target_language && session.scenario?.target_language) {
        session = {
          ...session,
          target_language: session.scenario.target_language
        };
      }
  
      if (!session.target_language) {
        console.error('Missing target language:', session);
        throw new Error('Target language is required');
      }
  
      // Get encryption key
      const key = await EncryptionService.getEncryptionKey(session.userId);
      console.log('Encryption status:', { hasKey: !!key });
  
      // Encrypt messages if we have a key
      const processedMessages = await Promise.all(
        messages.map(msg => 
          key ? EncryptionService.encryptChatMessage(msg, session.userId) : msg
        )
      );
  
      const metrics = this.calculateMetrics(session, messages);
      
      // Add timeout protection to prevent hanging on network issues
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network request timeout')), 5000);
      });
      
      const savePromise = supabase
        .from('chat_sessions')
        .upsert({
          id: session.id,
          user_id: session.userId,
          scenario_id: session.scenarioId,
          messages: processedMessages,
          source_language: session.source_language,
          target_language: session.target_language,
          status: session.status,
          metrics,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();
  
      // Race the promises to handle timeouts
      const { data, error } = await Promise.race([savePromise, timeoutPromise])
        .catch(error => {
          console.log('Network error or timeout:', error);
          return { data: null, error };
        });
      
      if (error) {
        console.error('Supabase error:', error);
        return null; // Don't throw, just return null
      }
      
      return data;
    } catch (error) {
      console.error('Error saving chat session:', error);
      // Don't throw, return null to allow app to continue functioning
      return null;
    }
  }

  static async completeSession(sessionId: string, messages: ChatMessage[]) {
    try {
      // Check network connection first
      if (!(await this.isNetworkConnected())) {
        console.log('Network unavailable, skipping server completion');
        return null; // Return null instead of throwing when offline
      }
      
      console.log('ChatService - Completing session:', {
        sessionId,
        messageCount: messages.length
      });

      const formattedMessages = messages.map(msg => ({
        ...msg,
        timestamp: new Date(Math.floor(msg.timestamp / 1000) * 1000).toISOString()
      }));

      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network request timeout')), 5000);
      });
      
      const updatePromise = supabase
        .from('chat_sessions')
        .update({
          messages: formattedMessages,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

      // Race the promises to handle timeouts
      const { data, error } = await Promise.race([updatePromise, timeoutPromise])
        .catch(error => {
          console.log('Network error or timeout:', error);
          return { data: null, error };
        });
      
      if (error) {
        console.error('Supabase error:', error);
        return null; // Don't throw, just return null
      }
      
      return data;
    } catch (error) {
      console.error('ChatService - Error completing session:', error);
      // Don't throw, return null to allow app to continue functioning
      return null;
    }
  }

  /**
   * Anonymizes a session by removing personally identifiable information
   * This is used during account deletion when full deletion isn't possible
   */
  static async anonymizeSession(sessionId: string): Promise<boolean> {
    try {
      // Check network connection first
      if (!(await this.isNetworkConnected())) {
        console.log('Network unavailable, skipping session anonymization');
        return false;
      }
      
      console.log('Anonymizing session:', sessionId);
      
      // First, get the session to check if we need to modify messages
      const { data: session, error: fetchError } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('id', sessionId)
        .single();
        
      if (fetchError) {
        console.error('Error fetching session for anonymization:', fetchError);
        return false;
      }
      
      // Create anonymized messages if any exist
      let anonymizedMessages: any[] = [];
      if (session.messages && Array.isArray(session.messages) && session.messages.length > 0) {
        // For each message, remove any potential PII but keep the structure
        anonymizedMessages = session.messages.map((msg: any, index: number) => ({
          id: `anon_${index}`,
          content: {
            original: index % 2 === 0 ? "[User message removed]" : "[Assistant response removed]",
            translated: index % 2 === 0 ? "[User message removed]" : "[Assistant response removed]",
          },
          sender: index % 2 === 0 ? "user" : "assistant",
          timestamp: msg.timestamp || new Date().toISOString(),
          isEdited: false
        }));
      }
      
      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network request timeout')), 5000);
      });
      
      const updatePromise = supabase
        .from('chat_sessions')
        .update({
          user_id: 'deleted', // We use a placeholder instead of null to maintain referential integrity
          messages: anonymizedMessages,
          metrics: {
            messageCount: anonymizedMessages.length,
            duration: 0,
            startTime: new Date().toISOString(),
            lastMessageTime: new Date().toISOString()
          },
          status: 'deleted',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      // Race the promises to handle timeouts
      const { error: updateError } = await Promise.race([updatePromise, timeoutPromise])
        .catch(error => {
          console.log('Network error or timeout:', error);
          return { error };
        });
        
      if (updateError) {
        console.error('Error anonymizing session:', updateError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in anonymizeSession:', error);
      return false;
    }
  }

  static async getSessionHistory(userId: string) {
    try {
      // Check network connection first
      if (!(await this.isNetworkConnected())) {
        console.log('Network unavailable, returning empty session history');
        return []; // Return empty array instead of throwing when offline
      }
      
      // Add timeout protection
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Network request timeout')), 5000);
      });
      
      const fetchPromise = supabase
        .from('chat_sessions')
        .select(`
          *,
          scenario:scenarios(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Race the promises to handle timeouts
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise])
        .catch(error => {
          console.log('Network error or timeout:', error);
          return { data: [], error };
        });
      
      if (error) {
        console.error('Error fetching session history:', error);
        return []; // Return empty array instead of throwing
      }
      
      return data || [];
    } catch (error) {
      console.error('Error fetching session history:', error);
      return []; // Return empty array instead of throwing
    }
  }

  private static calculateMetrics(session: Session, messages: ChatMessage[]): SessionMetrics {
    const userMessages = messages.filter(m => m.sender === 'user');
    const assistantMessages = messages.filter(m => m.sender === 'assistant');
    const startTime = new Date(session.startTime).toISOString();
    const lastMessageTime = new Date().toISOString();
    const duration = Math.floor((new Date().getTime() - new Date(startTime).getTime()) / 1000);

    return {
      messageCount: messages.length,
      userMessageCount: userMessages.length,
      assistantMessageCount: assistantMessages.length,
      duration,
      startTime,
      lastMessageTime
    };
  }
}