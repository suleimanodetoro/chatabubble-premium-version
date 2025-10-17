// constants/Config.ts
import Constants from 'expo-constants';

const rawExtra =
  (Constants as any).expoConfig?.extra ??
  (Constants as any).manifest?.extra;

interface Extra {
  OPENAI_API_KEY?:    string;
  SUPABASE_URL?:      string;
  SUPABASE_ANON_KEY?: string;
}

const extra = (rawExtra ?? {}) as Extra;
const { OPENAI_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY } = extra;

// Fail fast if anything’s missing
if (!OPENAI_API_KEY) {
  throw new Error('Missing EXPO extra: OPENAI_API_KEY');
}
if (!SUPABASE_URL) {
  throw new Error('Missing EXPO extra: SUPABASE_URL');
}
if (!SUPABASE_ANON_KEY) {
  throw new Error('Missing EXPO extra: SUPABASE_ANON_KEY');
}

export const Config = {
  OPENAI_API_KEY,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  BASE_URL: 'https://api.openai.com/v1/chat/completions',
  MODEL:    'gpt-4o',
};

// Dev-only log
if (__DEV__) {
  console.log('Config initialized with:', {
    OPENAI_API_KEY:    Boolean(OPENAI_API_KEY),
    SUPABASE_URL:      Boolean(SUPABASE_URL),
    SUPABASE_ANON_KEY: Boolean(SUPABASE_ANON_KEY),
  });
}
