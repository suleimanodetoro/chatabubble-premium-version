// lib/services/sync.ts
import { supabase } from '@/lib/supabase/client';
import { Session } from '@/types';

export class SyncService {
    static async syncChatSession(session: Session): Promise<{ success: boolean; shouldDeleteLocal: boolean }> {
        try {
          console.log('Syncing session to Supabase:', {
            sessionId: session.id,
            status: session.status,
            messageCount: session.messages.length
          });
    
          // Fix timestamps by converting to ISO strings
          const messages = session.messages.map(msg => ({
            ...msg,
            timestamp: new Date(Math.floor(msg.timestamp / 1000) * 1000).toISOString() // Convert milliseconds to seconds first
          }));
    
          const { error, data } = await supabase
            .from('chat_sessions')
            .upsert({
              id: session.id,
              user_id: session.userId,
              scenario_id: session.scenarioId,
              messages: messages,
              source_language: session.sourceLanguage,
              target_language: session.targetLanguage,
              status: session.status,
              metrics: {
                messageCount: session.messages.length,
                userMessageCount: messages.filter(m => m.sender === 'user').length,
                assistantMessageCount: messages.filter(m => m.sender === 'assistant').length,
                duration: Math.floor((Date.now() - session.startTime) / 1000), // Convert to seconds
                lastUpdated: new Date().toISOString(),
                languageCode: session.targetLanguage.code,
                sessionCompleted: session.status === 'completed'
              }
            })
            .select()
            .single();
    
          if (error) throw error;
    
          console.log('Supabase sync successful:', {
            sessionId: session.id,
            status: data.status,
            messageCount: data.messages?.length
          });
    
          return { 
            success: true, 
            shouldDeleteLocal: session.status === 'completed' 
          };
        } catch (error) {
          console.error('Error syncing chat session:', error, {
            sessionId: session.id,
            status: session.status
          });
          return { success: false, shouldDeleteLocal: false };
        }
      }
  // Add this helper method to SyncService
private static calculateAverageResponseTime(messages: ChatMessage[]): number {
    let totalTime = 0;
    let responseCount = 0;
    
    for (let i = 1; i < messages.length; i++) {
      if (messages[i].sender === 'assistant' && messages[i-1].sender === 'user') {
        totalTime += new Date(messages[i].timestamp).getTime() - 
                    new Date(messages[i-1].timestamp).getTime();
        responseCount++;
      }
    }
    
    return responseCount > 0 ? totalTime / responseCount : 0;
  }

  static async fetchSavedSessions(userId: string) {
    try {
      const { data, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['completed', 'saved'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching saved sessions:', error);
      throw error;
    }
  }

  static async cleanupOldSessions(userId: string, daysOld = 30) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { error } = await supabase
        .from('chat_sessions')
        .delete()
        .eq('user_id', userId)
        .eq('status', 'completed')
        .lt('created_at', cutoffDate.toISOString());

      if (error) throw error;
    } catch (error) {
      console.error('Error cleaning up old sessions:', error);
      throw error;
    }
  }
}