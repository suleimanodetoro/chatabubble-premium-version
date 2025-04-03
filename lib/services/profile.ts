// lib/services/profile.ts
import { supabase } from '@/lib/supabase/client';
import { Language } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ProfileSettings {
  notifications?: boolean;
  theme?: 'light' | 'dark' | 'system';
  hasCompletedOnboarding?: boolean;
}

export class ProfileService {
  static async generateUniqueUsername(baseUsername: string): Promise<string> {
    let username = baseUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
    let counter = 0;
    let isUnique = false;
    let finalUsername = username;

    while (!isUnique) {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', finalUsername)
        .maybeSingle();

      if (!data) {
        isUnique = true;
      } else {
        counter++;
        finalUsername = `${username}${counter}`;
      }
    }

    return finalUsername;
  }

  static async setupProfile(userId: string, email: string) {
    try {
      console.log('Attempting to setup profile for:', userId);

      // First check if profile exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select()
        .eq('id', userId)
        .maybeSingle();

      if (existingProfile) {
        console.log('Profile already exists:', existingProfile);
        return existingProfile;
      }

      // Generate unique username
      const baseUsername = email.split('@')[0];
      const username = await this.generateUniqueUsername(baseUsername);

      // Insert new profile with current timestamp
      const now = new Date().toISOString();
      const newProfile = {
        id: userId,
        created_at: now,
        updated_at: now,
        username,
        native_language: { code: 'en', name: 'English', direction: 'ltr' },
        learning_languages: [],
        current_levels: {},
        daily_streak: 0,
        settings: { hasCompletedOnboarding: false } // Initialize with onboarding not completed
      };

      console.log('Inserting new profile:', newProfile);

      const { data: createdProfile, error: insertError } = await supabase
        .from('profiles')
        .insert([newProfile])
        .select()
        .maybeSingle();

      if (insertError) {
        console.error('Profile creation error:', insertError);
        if (insertError.code === '23505') { // unique violation
          console.log('Profile already exists, attempting to fetch');
          const { data: existingProfile } = await supabase
            .from('profiles')
            .select()
            .eq('id', userId)
            .maybeSingle();
          return existingProfile;
        }
        throw insertError;
      }

      console.log('Profile created successfully:', createdProfile);
      return createdProfile;
    } catch (error) {
      console.error('Error in setupProfile:', error);
      // Check if profile exists one last time before giving up
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select()
        .eq('id', userId)
        .maybeSingle();
      
      if (existingProfile) {
        return existingProfile;
      }
      throw error;
    }
  }

  static async getProfile(userId: string) {
    try {
      console.log('Fetching profile for:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select()
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getProfile:', error);
      return null;
    }
  }

  /**
   * Checks if a user has completed the onboarding process
   * Looks at both profile settings in the database and AsyncStorage
   */
  static async hasCompletedOnboarding(userId: string): Promise<boolean> {
    try {
      console.log('Checking if user has completed onboarding:', userId);
      
      // First check profile settings in the database
      const profile = await this.getProfile(userId);
      
      if (profile?.settings?.hasCompletedOnboarding === true) {
        console.log('Found onboarding completed in profile settings');
        return true;
      }
      
      // If not found in profile, check AsyncStorage as fallback
      const value = await AsyncStorage.getItem(`@onboarding_completed:${userId}`);
      if (value === 'true') {
        console.log('Found onboarding completed in AsyncStorage');
        
        // Update profile settings if found in AsyncStorage but not in profile
        if (profile) {
          await this.updateProfile(userId, {
            settings: {
              ...(profile.settings || {}),
              hasCompletedOnboarding: true
            }
          });
        }
        return true;
      }
      
      console.log('User has not completed onboarding');
      return false;
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false;
    }
  }

  static async updateProfile(userId: string, updates: Partial<{
    username?: string;
    settings?: ProfileSettings;
    native_language?: Language;
    current_levels?: Record<string, string>;
  }>) {
    try {
      console.log('Updating profile for:', userId, 'with:', updates);
      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)
        .select()
        .maybeSingle();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  }
}