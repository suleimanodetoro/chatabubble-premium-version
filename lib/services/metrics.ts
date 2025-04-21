// lib/services/metrics.ts - Removed streak and time metrics
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
    messageCount?: number;
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
  activeLanguages: number;
  languageProgress: Record<string, {
    sessionsCompleted: number;
    lastPracticed: string;
    level: 'beginner' | 'intermediate' | 'advanced';
    recentSessions: Session[];
  }>;
  recentSessions: Session[];
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
        target_language: dbSession.target_language,
        source_language: dbSession.source_language,
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
        activeLanguages: Object.keys(profile.current_levels || {}).length,
        languageProgress: {},
        recentSessions: transformedSessions.slice(0, 5),
      };

      // Calculate per-language metrics
      transformedSessions.forEach(session => {
        if (!session.target_language?.code) {
          console.warn('Session missing target language:', session.id);
          return;
        }

        const langCode = session.target_language.code;
        if (!metrics.languageProgress[langCode]) {
          metrics.languageProgress[langCode] = {
            sessionsCompleted: 0,
            lastPracticed: session.startTime.toString(),
            level: profile.current_levels?.[langCode] || 'beginner',
            recentSessions: []
          };
        }

        const langMetrics = metrics.languageProgress[langCode];
        langMetrics.sessionsCompleted++;
        
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

      // Update profile with new level only (removed streak updates)
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
        })
        .eq('id', session.userId);

    } catch (error) {
      console.error('Error updating session metrics:', error);
      throw error;
    }
  }
}