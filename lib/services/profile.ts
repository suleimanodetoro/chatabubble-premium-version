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
}