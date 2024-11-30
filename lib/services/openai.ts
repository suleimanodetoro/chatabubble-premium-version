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
                   IMPORTANT: Always respond in ${targetLanguage}.
                   Keep responses natural and conversational, matching the scenario context.`
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
        presence_penalty: 0.6, // Encourages new topics
        frequency_penalty: 0.5  // Reduces repetition
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('OpenAI API error:', error.response?.data);
        throw new Error(`API Error: ${error.response?.data?.error?.message || 'Unknown error'}`);
      }
      throw error;
    }
  }

  static async translateText(text: string, targetLanguage: string): Promise<string> {
    try {
      const response = await api.post('', {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a translator. Translate to ${targetLanguage}. 
                     Respond with ONLY the translation, no explanations.`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.3,
        max_tokens: 100
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error('Translation error:', error.response?.data);
        throw new Error('Translation failed');
      }
      throw error;
    }
  }
}