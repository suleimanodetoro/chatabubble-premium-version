import * as Speech from 'expo-speech';
import { Language } from '@/types';

export class SpeechService {
  private static isSpeaking = false;
  private static currentUtterance: string | null = null;

  private static async cleanup() {
    try {
      Speech.stop();
      this.isSpeaking = false;
      this.currentUtterance = null;
      // Add a small delay to ensure cleanup is complete
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error in speech cleanup:', error);
    }
  }

  static async speak(text: string, language: Language) {
    // If the same text is already speaking, stop it
    if (this.isSpeaking && this.currentUtterance === text) {
      await this.stop();
      return;
    }

    try {
      // Clean up any existing speech
      await this.cleanup();

      const langCode = this.getLanguageCode(language.code);
      const supported = await this.isLanguageSupported(langCode);
      
      if (!supported) {
        console.warn(`Language ${language.name} not supported for speech`);
        return;
      }

      this.isSpeaking = true;
      this.currentUtterance = text;

      return new Promise<void>((resolve, reject) => {
        const options = {
          language: langCode,
          pitch: 1.0,
          rate: 0.9,
          onStart: () => console.log('Speech started'),
          onDone: () => {
            this.cleanup();
            resolve();
          },
          onStopped: () => {
            this.cleanup();
            resolve();
          },
          onError: (error: any) => {
            this.cleanup();
            console.error('Speech error:', error);
            reject(error);
          },
        };

        Speech.speak(text, options);
      });
    } catch (error) {
      await this.cleanup();
      console.error('Speech service error:', error);
      throw error;
    }
  }

  static async stop() {
    await this.cleanup();
  }

  static async isLanguageSupported(langCode: string): Promise<boolean> {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      return voices.some(voice => voice.language.startsWith(langCode));
    } catch (error) {
      console.error('Error checking language support:', error);
      return false;
    }
  }

  private static getLanguageCode(code: string): string {
    const languageMap: Record<string, string> = {
      'en': 'en-US',
      'es': 'es-ES',
      'fr': 'fr-FR',
      'de': 'de-DE',
      'it': 'it-IT',
      'pt': 'pt-PT',
      'ja': 'ja-JP',
      'zh': 'zh-CN',
      'ko': 'ko-KR',
      'ar': 'ar-SA',
      'ru': 'ru-RU',
      'hi': 'hi-IN',
    };
    return languageMap[code] || code;
  }
}