// lib/services/speech.ts
import * as Speech from 'expo-speech';
import { Language } from '@/types';

export class SpeechService {
  static async speak(text: string, language: Language) {
    try {
      console.log('Attempting to speak:', { text, language: language.name }); // Debug log

      // Stop any currently playing speech (no await needed because stop() is synchronous)
      Speech.stop();

      const langCode = this.getLanguageCode(language.code);
      console.log('Using language code:', langCode); // Debug log

      // Check if currently speaking
      const isSpeaking = await Speech.isSpeakingAsync();
      console.log('Is currently speaking:', isSpeaking);

      // Check if language is supported before speaking
      const supported = await this.isLanguageSupported(langCode);
      if (!supported) {
        console.warn(`Language ${language.name} not supported for speech`);
        return; // Do not attempt to speak if not supported
      }

      const voices = await Speech.getAvailableVoicesAsync();
      console.log('Available voices:', voices.length);

      // Wrap Speech.speak in a promise to await its completion.
      await new Promise<void>((resolve, reject) => {
        Speech.speak(text, {
          language: langCode,
          pitch: 1.0,
          rate: 0.9,
          onStart: () => console.log('Speech started'),
          onDone: () => {
            console.log('Speech finished');
            resolve();
          },
          onStopped: () => {
            console.log('Speech stopped');
            resolve();
          },
          onError: (error) => {
            console.error('Speech error:', error);
            reject(error);
          },
        });
      });

    } catch (error) {
      console.error('Speech service error:', error);
      throw error;
    }
  }

  static stop() {
    // Now we define the stop method
    // Since Speech.stop() is synchronous, we just call it directly
    Speech.stop();
    console.log('Speech stopping requested');
  }

  static async isLanguageSupported(langCode: string): Promise<boolean> {
    const voices = await Speech.getAvailableVoicesAsync();
    return voices.some(voice => voice.language.startsWith(langCode));
  }

  private static getLanguageCode(code: string): string {
    // Map our language codes to BCP-47 language tags
    const languageMap: Record<string, string> = {
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'yo': 'yo-NG',
    };
    return languageMap[code] || code;
  }
}
