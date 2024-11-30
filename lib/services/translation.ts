// lib/services/translation.ts
import { Language } from '../../types';

export async function translateText(
  text: string,
  sourceLanguage: Language,
  targetLanguage: Language
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
        source: sourceLanguage.code,
        target: targetLanguage.code,
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