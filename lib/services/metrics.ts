// lib/services/metrics.ts
import { supabase } from '@/lib/supabase/client';
import { Session, Language } from '@/types';

interface UserMetrics {
  totalSessions: number;
  languageProgress: {
    [key: string]: {
      sessionsCompleted: number;
      totalDuration: number;
      lastPracticed: string;
    }
  };
}

export class MetricsService {
  static async updateSessionMetrics(session: Session) {
    try {
      // Update user's language progress
      const { data: existingMetrics, error: fetchError } = await supabase
        .from('profiles')
        .select('current_levels')
        .eq('id', session.userId)
        .single();

      if (fetchError) throw fetchError;

      const currentLevels = existingMetrics?.current_levels || {};
      const languageCode = session.targetLanguage.code;
      
      // Simple logic to update levels based on sessions completed
      // You might want to make this more sophisticated
      const sessionsForLanguage = await this.getCompletedSessionsCount(
        session.userId,
        languageCode
      );

      let newLevel = 'beginner';
      if (sessionsForLanguage > 20) newLevel = 'advanced';
      else if (sessionsForLanguage > 10) newLevel = 'intermediate';

      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          current_levels: {
            ...currentLevels,
            [languageCode]: newLevel
          }
        })
        .eq('id', session.userId);

      if (updateError) throw updateError;
    } catch (error) {
      console.error('Error updating metrics:', error);
      throw error;
    }
  }

  static async getCompletedSessionsCount(userId: string, languageCode: string) {
    try {
      const { count, error } = await supabase
        .from('chat_sessions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('target_language->>code', languageCode)
        .in('status', ['completed', 'saved']);

      if (error) throw error;
      return count || 0;
    } catch (error) {
      console.error('Error getting session count:', error);
      return 0;
    }
  }

  static async getUserMetrics(userId: string): Promise<UserMetrics> {
    try {
      // Get all completed sessions
      const { data: sessions, error } = await supabase
        .from('chat_sessions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['completed', 'saved']);

      if (error) throw error;

      // Calculate metrics
      const metrics: UserMetrics = {
        totalSessions: sessions?.length || 0,
        languageProgress: {}
      };

      sessions?.forEach(session => {
        const langCode = session.target_language.code;
        if (!metrics.languageProgress[langCode]) {
          metrics.languageProgress[langCode] = {
            sessionsCompleted: 0,
            totalDuration: 0,
            lastPracticed: session.created_at
          };
        }

        metrics.languageProgress[langCode].sessionsCompleted++;
        metrics.languageProgress[langCode].totalDuration += 
          session.metrics?.duration || 0;
        
        // Update last practiced if this session is more recent
        if (new Date(session.created_at) > 
            new Date(metrics.languageProgress[langCode].lastPracticed)) {
          metrics.languageProgress[langCode].lastPracticed = session.created_at;
        }
      });

      return metrics;
    } catch (error) {
      console.error('Error getting user metrics:', error);
      throw error;
    }
  }
}