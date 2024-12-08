// lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Database } from './types';
import { Config } from '@/constants/Config';

if (!Config.SUPABASE_URL || !Config.SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(Config.SUPABASE_URL, Config.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Development helpers
export const isDevelopment = __DEV__;

export const usage = {
  async trackAPICall(feature: string) {
    if (isDevelopment) {
      console.log(`API Call to ${feature}`);
      const usage = await AsyncStorage.getItem('api_usage');
      const usageData = usage ? JSON.parse(usage) : {};
      usageData[feature] = (usageData[feature] || 0) + 1;
      await AsyncStorage.setItem('api_usage', JSON.stringify(usageData));
    }
  }
};