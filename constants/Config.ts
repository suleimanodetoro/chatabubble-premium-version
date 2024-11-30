// constants/Config.ts
import Constants from 'expo-constants';

export const Config = {
  OPENAI_API_KEY: Constants.expoConfig.extra.OPENAI_API_KEY,
  BASE_URL: 'https://api.openai.com/v1/chat/completions',
  MODEL: 'gpt-4-turbo-preview',
};