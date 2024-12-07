// app.config.js
import 'dotenv/config';

export default {
    expo: {
      // ... other config
      extra: {
        OPENAI_API_KEY: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
      },
    },
  };