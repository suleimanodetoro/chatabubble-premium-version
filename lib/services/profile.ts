// lib/services/profile.ts
import { supabase } from '@/lib/supabase/client';
import { Language } from '@/types';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface ProfileSettings {
  notifications?: boolean;
  theme?: 'light' | 'dark' | 'system';
  hasCompletedOnboarding?: boolean;
  // Add other settings as needed
}

// Define a type for the profile data including the new fields
// You might want to sync this with your Database types in lib/supabase/types.ts
type ProfileData = {
    id: string;
    updated_at: string;
    username: string | null;
    native_language: any; // Consider defining a specific type if possible
    learning_languages: any[]; // Consider defining a specific type if possible
    current_levels: any; // Consider defining a specific type if possible
    daily_streak: number | null;
    last_practice: string | null;
    settings: ProfileSettings | null;
    created_at: string; // Added based on your SQL output
    daily_message_count?: number | null; // Added field
    last_message_date?: string | null; // Added field (date as string 'YYYY-MM-DD')
};

// Type for the updates allowed in updateProfile, including new fields
// Moved outside the class definition
type ProfileUpdates = Partial<{
    username?: string;
    settings?: ProfileSettings;
    native_language?: Language; // Assuming Language type is appropriate
    current_levels?: Record<string, string>; // Example type, adjust if needed
    daily_message_count?: number; // Allow updating count
    last_message_date?: string; // Allow updating date
    // Add other updatable fields as needed
}>;


export class ProfileService {
  // --- Existing methods ---
  static async generateUniqueUsername(baseUsername: string): Promise<string> {
    let username = baseUsername.toLowerCase().replace(/[^a-z0-9]/g, '');
    let counter = 0;
    let isUnique = false;
    let finalUsername = username;

    while (!isUnique) {
      const { data, error } = await supabase
        .from('profiles')
        .select('username', { count: 'exact', head: true }) // More efficient check
        .eq('username', finalUsername);


      if (error) {
          console.error("Error checking username uniqueness:", error);
          throw error; // Rethrow errors
      }

      // Check the count from the response header
      if (data === null) { // No match found
        isUnique = true;
      } else {
        counter++;
        finalUsername = `${username}${counter}`;
        if (counter > 100) { // Add a safety break
            console.error("Could not generate unique username after 100 attempts for:", baseUsername);
            throw new Error("Failed to generate unique username.");
        }
      }
    }

    return finalUsername;
  }

  static async setupProfile(userId: string, email: string): Promise<ProfileData | null> {
    try {
      console.log('Attempting to setup profile for:', userId);

      // First check if profile exists
      const { data: existingProfile, error: fetchError } = await supabase
        .from('profiles')
        .select<"*", ProfileData>('*') // Specify the expected return type
        .eq('id', userId)
        .maybeSingle();

       if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 = 'Requested range not satisfiable' (means 0 rows)
           console.error("Error fetching existing profile during setup:", fetchError);
           throw fetchError;
       }

      if (existingProfile) {
        console.log('Profile already exists:', existingProfile);
        // Ensure existing profile has the new fields, default if necessary
        return {
            ...existingProfile,
            daily_message_count: existingProfile.daily_message_count ?? 0,
            last_message_date: existingProfile.last_message_date ?? null,
        };
      }

      // Generate unique username
      const baseUsername = email.split('@')[0] || `user_${userId.substring(0, 6)}`; // Fallback username
      const username = await this.generateUniqueUsername(baseUsername);

      // Insert new profile with current timestamp
      const now = new Date().toISOString();
      // Define the data to insert, matching the ProfileData type structure (excluding fields with defaults in DB like created_at)
      const newProfileData: Omit<ProfileData, 'created_at'> & { id: string } = {
        id: userId,
        updated_at: now,
        username,
        native_language: { code: 'en', name: 'English', direction: 'ltr' }, // Default native language
        learning_languages: [],
        current_levels: {},
        daily_streak: 0,
        last_practice: null,
        settings: { hasCompletedOnboarding: false },
        daily_message_count: 0, // Initialize new fields
        last_message_date: null
      };

      console.log('Inserting new profile:', newProfileData);

      const { data: createdProfile, error: insertError } = await supabase
        .from('profiles')
        .insert(newProfileData) // Pass the structured data
        .select<"*", ProfileData>('*') // Specify return type
        .single(); // Use single() as insert should return exactly one row

      if (insertError) {
        console.error('Profile creation error:', insertError);
        // Handle potential race condition if profile was created between check and insert
        if (insertError.code === '23505') { // unique violation (likely on id)
          console.log('Profile likely created concurrently, attempting to fetch again');
          const { data: concurrentProfile, error: concurrentFetchError } = await supabase
            .from('profiles')
            .select<"*", ProfileData>('*')
            .eq('id', userId)
            .single(); // Use single here, it should exist now

           if (concurrentFetchError) {
                console.error("Error fetching profile after concurrent insert:", concurrentFetchError);
                throw concurrentFetchError; // Throw if fetch fails after race condition
           }
           if (!concurrentProfile) {
                console.error("Profile still not found after concurrent insert attempt.");
                throw new Error("Profile creation failed unexpectedly.");
           }
           // Return fetched profile with defaults for new fields
           return {
                ...concurrentProfile,
                daily_message_count: concurrentProfile.daily_message_count ?? 0,
                last_message_date: concurrentProfile.last_message_date ?? null,
           };
        }
        throw insertError; // Throw other insert errors
      }

      console.log('Profile created successfully:', createdProfile);
      // Ensure returned profile has defaults for new fields
      return {
          ...createdProfile,
          daily_message_count: createdProfile.daily_message_count ?? 0,
          last_message_date: createdProfile.last_message_date ?? null,
      };
    } catch (error) {
      console.error('Error in setupProfile:', error);
      // Attempt a final fetch before giving up
      const { data: finalFetchProfile, error: finalFetchError } = await supabase
        .from('profiles')
        .select<"*", ProfileData>('*')
        .eq('id', userId)
        .maybeSingle();

       if (finalFetchError && finalFetchError.code !== 'PGRST116') {
           console.error("Final fetch attempt failed in setupProfile catch block:", finalFetchError);
       }

      if (finalFetchProfile) {
          // Return fetched profile with defaults for new fields
          return {
            ...finalFetchProfile,
            daily_message_count: finalFetchProfile.daily_message_count ?? 0,
            last_message_date: finalFetchProfile.last_message_date ?? null,
          };
      }
      // If still not found or fetch failed, return null
      return null;
    }
  }

  static async getProfile(userId: string): Promise<ProfileData | null> {
    try {
      console.log('Fetching profile for:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select<"*", ProfileData>('*') // Specify return type
        .eq('id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') { // Ignore 'Not found' error
        console.error('Error fetching profile:', error);
        return null;
      }
      if (!data) {
          console.log(`Profile not found for user ${userId}.`);
          return null;
      }

      // Ensure new fields have default values if they are null from DB
      return {
          ...data,
          daily_message_count: data.daily_message_count ?? 0,
          last_message_date: data.last_message_date ?? null,
      };
    } catch (error) {
      console.error('Error in getProfile:', error);
      return null;
    }
  }

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
          // Ensure settings object exists before merging
          const currentSettings = profile.settings || {};
          await this.updateProfile(userId, {
            settings: {
              ...currentSettings,
              hasCompletedOnboarding: true
            }
          });
          console.log('Updated profile settings from AsyncStorage onboarding status.');
        } else {
            console.warn(`Profile not found for user ${userId}, cannot update onboarding status from AsyncStorage.`);
        }
        return true;
      }

      console.log('User has not completed onboarding');
      return false;
    } catch (error) {
      console.error('Error checking onboarding status:', error);
      return false; // Default to false on error
    }
  }

  static async updateProfile(userId: string, updates: ProfileUpdates): Promise<ProfileData | null> {
    try {
      console.log('Updating profile for:', userId, 'with:', updates);
      // Ensure we don't try to update the primary key 'id' or 'created_at'
      const { id, created_at, ...validUpdates } = updates as any; // Cast to remove PKs if present

      const updatePayload = {
        ...validUpdates,
        updated_at: new Date().toISOString() // Always update timestamp
      };

      const { data, error } = await supabase
        .from('profiles')
        .update(updatePayload)
        .eq('id', userId)
        .select<"*", ProfileData>('*') // Specify return type
        .single(); // Expect one row updated

      if (error) {
          console.error("Error updating profile:", error);
          throw error; // Re-throw Supabase errors
      }
      if (!data) {
          console.error(`Profile update for ${userId} returned no data. Profile might not exist.`);
          return null;
      }

      console.log("Profile updated successfully:", data);
      // Ensure returned data has defaults for potentially null fields
       return {
          ...data,
          daily_message_count: data.daily_message_count ?? 0,
          last_message_date: data.last_message_date ?? null,
      };
    } catch (error) {
      console.error('Unexpected error in updateProfile:', error);
      throw error; // Re-throw unexpected errors
    }
  }


  // --- NEW METHOD ---
  /**
   * Checks if the user is under their daily message limit and increments the count if so.
   * Resets the count if the date has changed.
   * @param userId The ID of the user.
   * @param dailyLimit The maximum number of messages allowed per day.
   * @returns {Promise<{allowed: boolean, currentCount: number}>} - Whether the message is allowed and the updated count.
   */
  static async checkAndIncrementMessageCount(userId: string, dailyLimit: number): Promise<{ allowed: boolean; currentCount: number }> {
    if (!userId) {
      console.error("checkAndIncrementMessageCount: userId is required.");
      return { allowed: false, currentCount: 0 };
    }

    const today = new Date().toISOString().split('T')[0]; // Get 'YYYY-MM-DD'

    try {
      // Fetch the current count and date using getProfile which handles defaults
      const profileData = await this.getProfile(userId);

      if (!profileData) {
         console.error(`Profile not found for user ${userId} during message count check.`);
         // If profile doesn't exist, disallow sending messages until it's created
         return { allowed: false, currentCount: 0 };
      }

      let currentCount = profileData.daily_message_count ?? 0; // Use default from getProfile
      const lastDate = profileData.last_message_date; // Use default from getProfile

      const updates: ProfileUpdates = {};
      let needsUpdate = false;

      // Reset count if the date has changed
      if (lastDate !== today) {
        console.log(`Date changed for user ${userId}. Resetting message count from ${currentCount} to 1.`);
        currentCount = 0; // Reset before check
        updates.daily_message_count = 1; // Start count at 1 for the current message
        updates.last_message_date = today;
        needsUpdate = true;
      }

      // Check against the limit *after* potential reset
      if (currentCount >= dailyLimit) {
        console.log(`User ${userId} reached daily message limit of ${dailyLimit} (Count: ${currentCount}).`);
        // No need to update DB if limit is reached and date hasn't changed
        return { allowed: false, currentCount };
      }

      // If it wasn't reset and limit not reached, prepare to increment the count
      if (!needsUpdate) {
        updates.daily_message_count = currentCount + 1;
        // No need to update last_message_date if it's already today
        needsUpdate = true;
      }

      // Update the profile in the database if needed
      if (needsUpdate) {
          console.log(`Attempting to update profile for ${userId} with:`, updates);
          // Use the updateProfile method to handle the update
          const updatedProfile = await this.updateProfile(userId, updates);

          if (!updatedProfile) {
            console.error(`Failed to update message count for user ${userId}. Disallowing message.`);
            // If update fails, disallow message for safety
            // The count wasn't successfully incremented in the DB
            return { allowed: false, currentCount: currentCount }; // Return the count *before* attempted increment
          }
          // Use the count returned from the successful update
          const finalCount = updatedProfile.daily_message_count ?? 0;
          console.log(`User ${userId} message count updated to: ${finalCount}`);
          return { allowed: true, currentCount: finalCount };

      } else {
          // This case should only happen if limit was reached on the same day (no update needed)
          // We already returned { allowed: false } above in that case.
          console.log(`checkAndIncrementMessageCount: No DB update needed for user ${userId}. Current count: ${currentCount}`);
          return { allowed: true, currentCount: currentCount }; // Allow message, count is currentCount
      }

    } catch (error) {
      console.error(`Unexpected error in checkAndIncrementMessageCount for user ${userId}:`, error);
      return { allowed: false, currentCount: 0 }; // Disallow on unexpected errors
    }
  }

} 