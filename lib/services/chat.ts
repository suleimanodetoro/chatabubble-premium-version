// @/lib/services/chat.ts 

import { supabase } from '../supabase/client';
import { Session, ChatMessage } from '@/types';
import { EncryptionService } from './encryption';


interface SessionMetrics {
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  duration: number;
  startTime: string;
  lastMessageTime: string;
}

export class ChatService {
  static async createOrUpdateSession(session: Session, messages: ChatMessage[]) {
    try {
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
      
      const { data, error } = await supabase
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
  
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error saving chat session:', error);
      throw error;
    }
  }

  static async completeSession(sessionId: string, messages: ChatMessage[]) {
    try {
      console.log('ChatService - Completing session:', {
        sessionId,
        messageCount: messages.length
      });

      const formattedMessages = messages.map(msg => ({
        ...msg,
        timestamp: new Date(Math.floor(msg.timestamp / 1000) * 1000).toISOString()
      }));

      const { data, error } = await supabase
        .from('chat_sessions')
        .update({
          messages: formattedMessages,
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('ChatService - Error completing session:', error);
      throw error;
    }
  }

  /**
   * Anonymizes a session by removing personally identifiable information
   * This is used during account deletion when full deletion isn't possible
   */
  static async anonymizeSession(sessionId: string): Promise<boolean> {
    try {
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
      
      // Update the session with anonymized data
      const { error: updateError } = await supabase
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
      const { data, error } = await supabase
        .from('chat_sessions')
        .select(`
          *,
          scenario:scenarios(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching session history:', error);
      throw error;
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