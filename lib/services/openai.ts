// lib/services/openai.ts 
import axios from 'axios';
import { Config } from '../../constants/Config';
import { ChatMessage, Scenario } from '../../types';

const api = axios.create({
  baseURL: Config.BASE_URL,
  headers: {
    'Authorization': `Bearer ${Config.OPENAI_API_KEY}`,
    'Content-Type': 'application/json',
  },
});

export class OpenAIService {
  private static cleanResponse(response: string): string {
    // Remove any [Translation: ...] blocks and extra whitespace
    return response
      .replace(/\[Translation:.*?\]/g, '')
      .replace(/Translation:.*$/m, '')
      .trim();
  }

  static async generateChatCompletion(
    messages: ChatMessage[],
    scenario: Scenario,
    targetLanguage: string
  ) {
    try {
      const formattedMessages = [
        {
          role: 'system',
          content: `You are ${scenario.persona.name}, a ${scenario.persona.role}. 
                   Personality: ${scenario.persona.personality}
                   Context: ${scenario.description}
                   IMPORTANT: 
                   - Always respond ONLY in ${targetLanguage}
                   - Maintain consistency with your previous statements
                   - Remember and acknowledge previous context
                   - If you previously mentioned leaving or any other state, maintain that context
                   - Keep responses natural and conversational
                   - DO NOT include any translations or English text
                   - NEVER use [Translation] tags or brackets`
        },
        {
          role: 'system',
          content: `Current conversation summary:
                   - User messages are in English
                   - Your responses must be only in ${targetLanguage}
                   - Never include translations or English text
                   - Maintain conversation context and consistency`
        },
        ...messages.map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          content: msg.content.original
        }))
      ];

      const response = await api.post('', {
        model: Config.MODEL,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 150,
        presence_penalty: 0.6,
        frequency_penalty: 0.5
      });

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid API response format');
      }

      const rawResponse = response.data.choices[0].message.content;
      return this.cleanResponse(rawResponse);
    } catch (error) {
      console.error('OpenAI API error:', error);
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.error?.message || 'Unknown error';
        throw new Error(`API Error: ${errorMessage}`);
      }
      throw new Error('Failed to generate response');
    }
  }

  static async translateText(text: string, targetLanguage: string): Promise<string> {
    try {
      const response = await api.post('', {
        model: Config.MODEL,
        messages: [
          {
            role: 'system',
            content: `You are a translator. Translate the following text to ${targetLanguage}. 
                     Respond with ONLY the translation, no explanations or brackets.`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 100
      });

      if (!response.data?.choices?.[0]?.message?.content) {
        throw new Error('Invalid translation response format');
      }

      return this.cleanResponse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Translation error:', error);
      if (axios.isAxiosError(error) && error.response?.data?.error) {
        throw new Error(`Translation failed: ${error.response.data.error.message}`);
      }
      throw new Error('Translation failed. Please try again.');
    }
  }
}