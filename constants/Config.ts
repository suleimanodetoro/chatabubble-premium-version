// constants/Config.ts
import * as Constants from 'expo-constants';

// Check if we have access to the extra properties
const OPENAI_API_KEY = Constants.expoConfig?.extra?.OPENAI_API_KEY ?? process.env.EXPO_PUBLIC_OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
  console.warn('OpenAI API key not found in configuration');
}

export const Config = {
  OPENAI_API_KEY,
  BASE_URL: 'https://api.openai.com/v1/chat/completions',
  MODEL: 'gpt-4o',
};

// Add this type check to help debug
if (__DEV__) {
  console.log('Config initialized with API key:', OPENAI_API_KEY ? 'present' : 'missing');
}