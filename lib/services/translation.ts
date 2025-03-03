// lib/services/translation.ts
import { Language } from '../../types';

export async function translateText(
  text: string,
  source_language: Language,
  target_language: Language
): Promise<string> {
  // TODO: Replace with your preferred translation API
  // Example using a mock API for now
  try {
    const response = await fetch('YOUR_TRANSLATION_API_ENDPOINT', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add your API key here
      },
      body: JSON.stringify({
        text,
        source: source_language.code,
        target: target_language.code,
      }),
    });

    if (!response.ok) {
      throw new Error('Translation failed');
    }

    const data = await response.json();
    return data.translatedText;
  } catch (error) {
    console.error('Translation error:', error);
    throw error;
  }
}