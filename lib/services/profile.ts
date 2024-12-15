// lib/services/profile.ts
import { supabase } from '@/lib/supabase/client';
import { Language } from '@/types';

export class ProfileService {
  static async setupProfile(userId: string, email: string) {
    try {
      // Check if profile exists first
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (existingProfile) return existingProfile;

      // Create new profile if doesn't exist
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: email.split('@')[0],
          native_language: { code: 'en', name: 'English', direction: 'ltr' },
          learning_languages: [],
          current_levels: {},
          daily_streak: 0,
          settings: {}
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error setting up profile:', error);
      throw error;
    }
  }

  static async getProfile(userId: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting profile:', error);
      throw error;
    }
  }

  static async updateProfile(userId: string, updates: Partial<{
    learning_languages: Language[];
    current_levels: Record<string, string>;
    settings: Record<string, any>;
  }>) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }
  // Add new method for fetching user stats
  static async getUserStats(userId: string) {
    try {
      const { data: sessions, error: sessionsError } = await supabase
        .from('chat_sessions')
        .select(`
          id,
          created_at,
          status,
          metrics,
          target_language
        `)
        .eq('user_id', userId);

      if (sessionsError) throw sessionsError;

      // Calculate stats
      const stats = {
        totalSessions: sessions.length,
        completedSessions: sessions.filter(s => s.status === 'completed').length,
        languageProgress: {} as Record<string, {
          sessionsCount: number,
          completedCount: number,
          lastPracticed: string | null
        }>
      };

      // Aggregate stats per language
      sessions.forEach(session => {
        const langCode = session.target_language.code;
        if (!stats.languageProgress[langCode]) {
          stats.languageProgress[langCode] = {
            sessionsCount: 0,
            completedCount: 0,
            lastPracticed: null
          };
        }
        
        stats.languageProgress[langCode].sessionsCount++;
        if (session.status === 'completed') {
          stats.languageProgress[langCode].completedCount++;
        }
        
        // Update last practiced
        const sessionDate = new Date(session.created_at).toISOString();
        if (!stats.languageProgress[langCode].lastPracticed || 
            sessionDate > stats.languageProgress[langCode].lastPracticed) {
          stats.languageProgress[langCode].lastPracticed = sessionDate;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw error;
    }
  }

  // Add method for updating streak
  static async updateStreak(userId: string) {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('daily_streak, last_practice')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      const now = new Date();
      const lastPractice = profile.last_practice ? new Date(profile.last_practice) : null;
      
      // Calculate if streak should be incremented or reset
      let newStreak = profile.daily_streak;
      if (!lastPractice) {
        newStreak = 1;
      } else {
        const daysSinceLastPractice = Math.floor(
          (now.getTime() - lastPractice.getTime()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysSinceLastPractice === 0) {
          // Already practiced today
          return profile;
        } else if (daysSinceLastPractice === 1) {
          // Next day practice - increment streak
          newStreak++;
        } else {
          // Missed days - reset streak
          newStreak = 1;
        }
      }

      const { data, error } = await supabase
        .from('profiles')
        .update({
          daily_streak: newStreak,
          last_practice: now.toISOString()
        })
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating streak:', error);
      throw error;
    }
  }
}