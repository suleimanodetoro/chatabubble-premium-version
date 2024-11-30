// app.config.js
import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  extra: {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  },
});

