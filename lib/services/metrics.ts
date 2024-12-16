// lib/services/metrics.ts
import { supabase } from '@/lib/supabase/client';
import { Session, Language } from '@/types';

// Add types to match DB schema
interface DBSession {
  id: string;
  user_id: string;
  scenario_id: string;
  target_language: Language;
  source_language: Language;
  messages: any[];
  created_at: string;
  updated_at: string;
  status: 'active' | 'completed' | 'saved';
  metrics: {
    duration?: number;
    messageCount?: number;
    lastUpdated?: number;
  };
  scenario?: {
    id: string;
    title: string;
    description: string;
    // ... other scenario fields
  };
}

interface UserMetrics {
  totalSessions: number;
  completedSessions: number;
  totalMinutesPracticed: number;
  activeLanguages: number;
  languageProgress: Record<string, {
    sessionsCompleted: number;
    totalDuration: number;
    lastPracticed: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    recentSessions: Session[];
  }>;
  recentSessions: Session[];
  streak: number;
  lastPracticed: string | null;
}

export class MetricsService {
  static async getUserMetrics(userId: string): Promise<UserMetrics> {
    try {
      console.log('Fetching metrics for user:', userId);

      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select(`
          *,
          scenario:scenarios(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (sessionsError) throw sessionsError;
      console.log('Fetched sessions:', sessions?.length);

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;
      console.log('Fetched profile');

      // Transform DB sessions to match our Session type
      const transformedSessions = (sessions || []).map((dbSession: DBSession) => ({
        id: dbSession.id,
        userId: dbSession.user_id,
        scenarioId: dbSession.scenario_id,
        targetLanguage: dbSession.target_language,
        sourceLanguage: dbSession.source_language,
        messages: dbSession.messages || [],
        startTime: new Date(dbSession.created_at).getTime(),
        lastUpdated: new Date(dbSession.updated_at).getTime(),
        status: dbSession.status,
        metrics: dbSession.metrics || {},
        scenario: dbSession.scenario
      }));

      const metrics: UserMetrics = {
        totalSessions: transformedSessions.length,
        completedSessions: transformedSessions.filter(s => s.status === 'completed').length,
        totalMinutesPracticed: transformedSessions.reduce((total, session) => 
          total + (session.metrics?.duration || 0) / 60000, 0),
        activeLanguages: Object.keys(profile.current_levels || {}).length,
        languageProgress: {},
        recentSessions: transformedSessions.slice(0, 5),
        streak: profile.daily_streak || 0,
        lastPracticed: profile.last_practice
      };

      // Calculate per-language metrics
      transformedSessions.forEach(session => {
        if (!session.targetLanguage?.code) {
          console.warn('Session missing target language:', session.id);
          return;
        }

        const langCode = session.targetLanguage.code;
        if (!metrics.languageProgress[langCode]) {
          metrics.languageProgress[langCode] = {
            sessionsCompleted: 0,
            totalDuration: 0,
            lastPracticed: session.startTime.toString(),
            level: profile.current_levels?.[langCode] || 'beginner',
            recentSessions: []
          };
        }

        const langMetrics = metrics.languageProgress[langCode];
        langMetrics.sessionsCompleted++;
        langMetrics.totalDuration += session.metrics?.duration || 0;
        
        if (langMetrics.recentSessions.length < 3) {
          langMetrics.recentSessions.push(session);
        }

        const sessionDate = new Date(session.startTime);
        if (sessionDate > new Date(langMetrics.lastPracticed)) {
          langMetrics.lastPracticed = session.startTime.toString();
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
      const langCode = session.target_language.code;
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