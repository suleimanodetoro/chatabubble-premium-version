// lib/services/sync.ts
import { supabase } from '@/lib/supabase/client';
import { Session } from '@/types';
import { StorageService } from './storage';

export class SyncService {
  static async syncChatSession(session: Session) {
    try {
      if (session.status !== 'completed' && session.status !== 'saved') {
        return;
      }

      const { error } = await supabase
        .from('chat_sessions')
        .upsert({
          id: session.id,
          user_id: session.userId,
          scenario_id: session.scenarioId,
          messages: session.messages,
          source_language: session.sourceLanguage,
          target_language: session.targetLanguage,
          status: session.status,
          metrics: {
            messageCount: session.messages.length,
            duration: Date.now() - session.startTime,
            lastUpdated: session.lastUpdated
          }
        });

      if (error) throw error;

      // Use the correct method name
      if (session.status === 'completed') {
        await StorageService.deleteSession(session.id);
      }
    } catch (error) {
      console.error('Error syncing chat session:', error);
      throw error;
    }
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