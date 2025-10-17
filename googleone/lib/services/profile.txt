// lib/services/profile.ts
import { supabase } from '@/lib/supabase/client';
import { Language, User as AppUserType } from '@/types'; // Renamed User to AppUserType to avoid conflict
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_COMPLETED_KEY_PREFIX = '@onboarding_completed:';

export interface ProfileSettings { // Exporting for use in AppUserType if needed
  notifications?: boolean;
  theme?: 'light' | 'dark' | 'system';
  hasCompletedOnboarding?: boolean;
}

// This type represents the data structure in your 'profiles' table
// and should be consistent with what AppUserType expects.
export type ProfileData = {
    id: string; // UUID, matches auth.users.id
    updated_at: string; // ISO string timestamp
    username: string | null;
    email?: string; // Typically from auth.users, not stored in profiles table unless duplicated
    native_language: Language;
    learning_languages: Language[];
    current_levels: Record<string, 'beginner' | 'intermediate' | 'advanced'>;
    daily_streak: number | null;
    last_practice: string | null; // ISO string timestamp
    settings: ProfileSettings | null;
    // created_at is handled by DB default
    daily_message_count?: number | null;
    last_message_date?: string | null; // Date string 'YYYY-MM-DD'
};

// For updates, allow partial data matching ProfileData, excluding system-set fields
export type ProfileUpdates = Partial<Omit<ProfileData, 'id' | 'updated_at' | 'email'>>;


export class ProfileService {
  static async generateUniqueUsername(baseUsername: string): Promise<string> {
    let username = baseUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!username) username = `user${Date.now().toString().slice(-6)}`;
    let counter = 0;
    let isUnique = false;
    let finalUsername = username;

    while (!isUnique && counter < 100) {
      const { error, count } = await supabase
        .from('profiles')
        .select('username', { count: 'exact', head: true })
        .eq('username', finalUsername);

      if (error) {
          console.error("ProfileService: Error checking username uniqueness:", error);
          finalUsername = `${username}_${Math.random().toString(36).substring(2, 7)}`;
          counter++;
          if (counter > 5) {
            throw new Error("Failed to generate unique username due to persistent database error.");
          }
          continue;
      }
      if (count === 0) {
        isUnique = true;
      } else {
        counter++;
        finalUsername = `${username}${counter}`;
      }
    }
     if (!isUnique) {
        console.error("ProfileService: Could not generate unique username after attempts for:", baseUsername);
        throw new Error("Failed to generate unique username after extensive attempts.");
    }
    return finalUsername;
  }

  static async setupProfile(userId: string, email: string): Promise<AppUserType | null> {
    try {
      console.log('ProfileService: Attempting to setup profile for:', userId);
      const { data: existingProfileData, error: fetchError } = await supabase
        .from('profiles')
        .select('*') // Fetches all columns from 'profiles' table
        .eq('id', userId)
        .maybeSingle();

       if (fetchError && fetchError.code !== 'PGRST116') {
           console.error("ProfileService: Error fetching existing profile during setup:", fetchError);
           throw fetchError;
       }
       
       let finalProfileData: ProfileData;

      if (existingProfileData) {
        console.log('ProfileService: Profile already exists:', existingProfileData);
        const settings = existingProfileData.settings || {};
        if (typeof settings.hasCompletedOnboarding !== 'boolean') {
            settings.hasCompletedOnboarding = false; 
        }
        if (!settings.hasCompletedOnboarding) {
            await AsyncStorage.removeItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`);
            console.log(`ProfileService: Cleared AsyncStorage onboarding flag for existing user ${userId} as DB indicates not completed.`);
        }
        finalProfileData = {
            ...existingProfileData,
            email: email, // Add email from auth context
            settings: settings,
            // Ensure defaults for any potentially nullable fields if not present
            native_language: existingProfileData.native_language || { code: 'en', name: 'English', direction: 'ltr' },
            learning_languages: existingProfileData.learning_languages || [],
            current_levels: existingProfileData.current_levels || {},
            daily_message_count: existingProfileData.daily_message_count ?? 0,
            last_message_date: existingProfileData.last_message_date ?? null,
            daily_streak: existingProfileData.daily_streak ?? 0,
            last_practice: existingProfileData.last_practice ?? null,
        };
      } else {
        // Profile does not exist, create it
        const baseUsername = email.split('@')[0] || `user_${userId.substring(0, 6)}`;
        const username = await this.generateUniqueUsername(baseUsername);
        const now = new Date().toISOString();
        
        const newProfileInsert = { // Data to insert into DB
          id: userId,
          updated_at: now,
          username,
          native_language: { code: 'en', name: 'English', direction: 'ltr' },
          learning_languages: [],
          current_levels: {},
          daily_streak: 0,
          last_practice: null,
          settings: { hasCompletedOnboarding: false }, 
          daily_message_count: 0,
          last_message_date: null
        };

        console.log('ProfileService: Inserting new profile:', newProfileInsert);
        const { data: createdDbProfile, error: insertError } = await supabase
          .from('profiles')
          .insert(newProfileInsert)
          .select('*') 
          .single();

        if (insertError) {
          console.error('ProfileService: Profile creation error:', insertError);
          if (insertError.code === '23505') { 
            console.log('ProfileService: Profile likely created concurrently, attempting to fetch again');
            const { data: concurrentProfile, error: concurrentFetchError } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', userId)
              .single();
             if (concurrentFetchError) throw concurrentFetchError;
             if (!concurrentProfile) throw new Error("Profile creation failed unexpectedly (concurrent fetch failed).");
             finalProfileData = { ...concurrentProfile, email: email, settings: concurrentProfile.settings || { hasCompletedOnboarding: false } };
          } else {
            throw insertError;
          }
        } else {
            finalProfileData = { ...createdDbProfile, email: email, settings: createdDbProfile.settings || { hasCompletedOnboarding: false } };
        }
        await AsyncStorage.removeItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`);
        console.log(`ProfileService: Cleared AsyncStorage onboarding flag for new user ${userId}.`);
      }
      // Adapt ProfileData to AppUserType for the store
      return {
          id: finalProfileData.id,
          name: finalProfileData.username || email.split('@')[0] || 'User', // Fallback for name
          email: finalProfileData.email || email, // Ensure email is present
          nativeLanguage: finalProfileData.native_language,
          learningLanguages: finalProfileData.learning_languages,
          currentLevel: finalProfileData.current_levels, // Ensure this matches AppUserType structure
          // Include other fields from AppUserType if they map from ProfileData
          settings: finalProfileData.settings // Pass along settings
      } as AppUserType;

    } catch (error) {
      console.error('ProfileService: Error in setupProfile:', error);
      return null; // Return null on error
    }
  }

  static async getProfile(userId: string): Promise<ProfileData | null> {
    console.log(`ProfileService: getProfile called for userId: ${userId}`);
    if (!userId) {
        console.warn("ProfileService: getProfile called with no userId.");
        return null;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*') // Selects all columns from 'profiles' table
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error(`ProfileService: Error fetching profile for ${userId} (code: ${error.code}):`, error.message);
        return null;
      }
      if (!data) {
          console.log(`ProfileService: Profile not found for user ${userId}.`);
          return null;
      }
      console.log(`ProfileService: Profile fetched successfully for user ${userId}.`);
      const settings = data.settings || {};
      if (typeof settings.hasCompletedOnboarding !== 'boolean') {
          settings.hasCompletedOnboarding = false;
      }
      // Add email from auth user if needed, though it's not directly in 'profiles'
      const { data: { user: authUser } } = await supabase.auth.getUser();
      return {
          ...data,
          email: authUser?.email, // Add email from auth context
          settings: settings,
          native_language: data.native_language || { code: 'en', name: 'English', direction: 'ltr' },
          learning_languages: data.learning_languages || [],
          current_levels: data.current_levels || {},
          daily_message_count: data.daily_message_count ?? 0,
          last_message_date: data.last_message_date ?? null,
          daily_streak: data.daily_streak ?? 0,
          last_practice: data.last_practice ?? null,
      };
    } catch (outerError) {
      console.error(`ProfileService: Outer catch block - Unexpected error in getProfile for userId ${userId}:`, outerError);
      return null;
    }
  }

  static async hasCompletedOnboarding(userId: string): Promise<boolean> {
    console.log(`ProfileService: hasCompletedOnboarding called for userId: ${userId}`);
    if (!userId) {
        console.warn("ProfileService: hasCompletedOnboarding called with no userId.");
        return false;
    }
    try {
      const profile = await this.getProfile(userId);
      console.log(`ProfileService: hasCompletedOnboarding - Profile fetched for check:`, profile ? `DB Status: ${profile.settings?.hasCompletedOnboarding}` : "Not found in DB");

      if (profile && profile.settings && typeof profile.settings.hasCompletedOnboarding === 'boolean') {
        const dbStatus = profile.settings.hasCompletedOnboarding;
        console.log(`ProfileService: User ${userId} onboarding status from DB: ${dbStatus}.`);
        // Sync AsyncStorage with DB truth
        if (dbStatus) {
            await AsyncStorage.setItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`, 'true');
        } else {
            await AsyncStorage.removeItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`);
        }
        return dbStatus;
      }
      
      // If DB profile doesn't exist or settings are missing, it implies onboarding is not complete.
      // Also, clear any potentially stale AsyncStorage flag in this case.
      console.log(`ProfileService: User ${userId} - DB profile not definitive or not found. Defaulting to onboarding NOT complete.`);
      await AsyncStorage.removeItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`);
      return false;

    } catch (error) {
      console.error(`ProfileService: Error checking onboarding status for ${userId}:`, error);
      return false; 
    }
  }

  static async updateProfile(userId: string, updates: ProfileUpdates): Promise<AppUserType | null> {
    try {
      console.log('ProfileService: Updating profile for:', userId, 'with:', updates);
      const { id, updated_at, email, ...validUpdates } = updates as any;

      const updatePayload = {
        ...validUpdates,
        updated_at: new Date().toISOString()
      };

      if (updates.settings && typeof updates.settings.hasCompletedOnboarding === 'boolean') {
        if (updates.settings.hasCompletedOnboarding) {
          await AsyncStorage.setItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`, 'true');
          console.log(`ProfileService: AsyncStorage onboarding flag set to true for ${userId}.`);
        } else {
          await AsyncStorage.removeItem(`${ONBOARDING_COMPLETED_KEY_PREFIX}${userId}`);
          console.log(`ProfileService: AsyncStorage onboarding flag removed for ${userId}.`);
        }
      }

      const { data: updatedDbProfile, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId)
        .select('*') 
        .single();

      if (error) {
          console.error("ProfileService: Error updating profile:", error);
          throw error;
      }
      if (!updatedDbProfile) {
          console.error(`ProfileService: Profile update for ${userId} returned no data.`);
          return null;
      }
      console.log("ProfileService: Profile updated successfully in DB:", updatedDbProfile);
      
      // Fetch email from auth to construct the AppUserType
      const { data: { user: authUser } } = await supabase.auth.getUser();

      // Adapt updated DB data to AppUserType
      return {
          id: updatedDbProfile.id,
          name: updatedDbProfile.username || authUser?.email?.split('@')[0] || 'User',
          email: authUser?.email || '', // Ensure email is present
          nativeLanguage: updatedDbProfile.native_language,
          learningLanguages: updatedDbProfile.learning_languages,
          currentLevel: updatedDbProfile.current_levels,
          settings: updatedDbProfile.settings
      } as AppUserType;

    } catch (error) {
      console.error('ProfileService: Unexpected error in updateProfile:', error);
      throw error;
    }
  }

  static async checkAndIncrementMessageCount(userId: string, dailyLimit: number): Promise<{ allowed: boolean; currentCount: number }> {
    if (!userId) {
      console.error("ProfileService: checkAndIncrementMessageCount - userId is required.");
      return { allowed: false, currentCount: 0 };
    }
    const today = new Date().toISOString().split('T')[0];
    try {
      const profileData = await this.getProfile(userId);
      if (!profileData) {
         console.error(`ProfileService: Profile not found for user ${userId} during message count check.`);
         return { allowed: false, currentCount: 0 };
      }

      let currentCount = profileData.daily_message_count ?? 0;
      const lastDate = profileData.last_message_date;

      const updates: ProfileUpdates = {};
      let needsUpdate = false;

      if (lastDate !== today) {
        console.log(`ProfileService: Date changed for user ${userId}. Resetting message count from ${currentCount} to 1.`);
        currentCount = 0; 
        updates.daily_message_count = 1;
        updates.last_message_date = today;
        needsUpdate = true;
      } else {
        if (currentCount >= dailyLimit) {
          console.log(`ProfileService: User ${userId} reached daily message limit of ${dailyLimit} (Count: ${currentCount}).`);
          return { allowed: false, currentCount };
        }
        updates.daily_message_count = currentCount + 1;
        if (!updates.last_message_date) updates.last_message_date = today;
        needsUpdate = true;
      }

      if (needsUpdate) {
          console.log(`ProfileService: Attempting to update profile for ${userId} with message count:`, updates);
          const updatedAppUser = await this.updateProfile(userId, updates); // updateProfile now returns AppUserType
          if (!updatedAppUser) { // Check if the update was successful
            console.error(`ProfileService: Failed to update message count for user ${userId}. Disallowing message.`);
            return { allowed: false, currentCount: profileData.daily_message_count ?? 0 };
          }
          // To get the updated count, we need to fetch the profile again or map from AppUserType if it contains daily_message_count
          // For simplicity, let's assume the update was successful and the count is updates.daily_message_count
          const finalCount = updates.daily_message_count ?? 0;
          console.log(`ProfileService: User ${userId} message count updated to: ${finalCount}`);
          return { allowed: true, currentCount: finalCount };
      } else {
          console.log(`ProfileService: checkAndIncrementMessageCount - No DB update deemed necessary for user ${userId}. Current count: ${currentCount}`);
          return { allowed: currentCount < dailyLimit, currentCount: currentCount };
      }
    } catch (error) {
      console.error(`ProfileService: Unexpected error in checkAndIncrementMessageCount for user ${userId}:`, error);
      return { allowed: false, currentCount: 0 };
    }
  }
}
