// @/lib/services/chat.ts

import { supabase } from '../supabase/client';
import { Session, ChatMessage } from '@/types';
import { EncryptionService } from './encryption';


interface SessionMetrics {
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  duration: number; // in seconds
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
  
      if (!session.target_language && session.scenario?.targetLanguage) {
        session = {
          ...session,
          target_language: session.scenario.targetLanguage
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
          source_language: session.sourceLanguage,
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