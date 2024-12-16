// lib/services/metrics.ts
import { supabase } from '@/lib/supabase/client';
import { Session, Language } from '@/types';

interface UserMetrics {
  // Session metrics
  totalSessions: number;
  completedSessions: number;
  totalMinutesPracticed: number;
  
  // Language metrics
  activeLanguages: number;
  languageProgress: Record<string, {
    sessionsCompleted: number;
    totalDuration: number;
    lastPracticed: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    recentSessions: Session[];
  }>;
  
  // Recent activity
  recentSessions: Session[];
  streak: number;
  lastPracticed: string | null;
}

export class MetricsService {
  static async getUserMetrics(userId: string): Promise<UserMetrics> {
    try {
      // Get all user sessions
      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select(`
          *,
          scenario:scenarios(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;

      // Get user profile for streak and language data
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const metrics: UserMetrics = {
        totalSessions: sessions.length,
        completedSessions: sessions.filter(s => s.status === 'completed').length,
        totalMinutesPracticed: sessions.reduce((total, session) => 
          total + (session.metrics?.duration || 0) / 60000, 0),
        activeLanguages: Object.keys(profile.current_levels || {}).length,
        languageProgress: {},
        recentSessions: sessions.slice(0, 5),
        streak: profile.daily_streak || 0,
        lastPracticed: profile.last_practice
      };

      // Calculate per-language metrics
      sessions.forEach(session => {
        const langCode = session.target_language.code;
        if (!metrics.languageProgress[langCode]) {
          metrics.languageProgress[langCode] = {
            sessionsCompleted: 0,
            totalDuration: 0,
            lastPracticed: session.created_at,
            level: profile.current_levels?.[langCode] || 'beginner',
            recentSessions: []
          };
        }

        const langMetrics = metrics.languageProgress[langCode];
        langMetrics.sessionsCompleted++;
        langMetrics.totalDuration += session.metrics?.duration || 0;
        
        // Track most recent 3 sessions per language
        if (langMetrics.recentSessions.length < 3) {
          langMetrics.recentSessions.push(session);
        }

        // Update last practiced if more recent
        if (new Date(session.created_at) > new Date(langMetrics.lastPracticed)) {
          langMetrics.lastPracticed = session.created_at;
        }
      });

      return metrics;
    } catch (error) {
      console.error('Error getting user metrics:', error);
      throw error;
    }
  }

  static async updateSessionMetrics(session: Session) {
    try {
      const metrics = await this.getUserMetrics(session.userId);
      const langCode = session.targetLanguage.code;
      const sessionsCompleted = metrics.languageProgress[langCode]?.sessionsCompleted || 0;

      // Determine level based on completed sessions
      let level = 'beginner';
      if (sessionsCompleted > 20) level = 'advanced';
      else if (sessionsCompleted > 10) level = 'intermediate';

      // Update profile with new level and streak
      await supabase
        .from('profiles')
        .update({
          current_levels: {
            ...metrics.languageProgress,
            [langCode]: {
              ...metrics.languageProgress[langCode],
              level
            }
          },
          last_practice: new Date().toISOString(),
          daily_streak: this.calculateStreak(metrics.lastPracticed)
        })
        .eq('id', session.userId);

    } catch (error) {
      console.error('Error updating session metrics:', error);
      throw error;
    }
  }

  private static calculateStreak(lastPracticed: string | null): number {
    if (!lastPracticed) return 1;
    
    const now = new Date();
    const last = new Date(lastPracticed);
    const daysDiff = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysDiff === 0) return 1; // First day
    if (daysDiff === 1) return 2; // Next day
    return 0; // Break in streak
  }
}