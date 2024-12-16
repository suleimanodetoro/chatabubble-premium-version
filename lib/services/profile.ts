// lib/services/profile.ts
import { supabase } from '@/lib/supabase/client';
import { Language } from '@/types';

interface ProfileSettings {
  notifications?: boolean;
  theme?: 'light' | 'dark' | 'system';
  // Add other settings as needed
}

export class ProfileService {
  static async setupProfile(userId: string, email: string) {
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (existingProfile) return existingProfile;

      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: email.split('@')[0],
          native_language: { code: 'en', name: 'English', direction: 'ltr' },
          learning_languages: [],
          current_levels: {},
          daily_streak: 0,
          settings: {},
          created_at: new Date().toISOString()
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
    username?: string;
    settings?: ProfileSettings;
    native_language?: Language;
  }>) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
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
}