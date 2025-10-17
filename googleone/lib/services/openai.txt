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
    // *** CHANGE: Made regex slightly more specific ***
    return response
      .replace(/\[Translation:[^\]]*\]/g, '') // Non-greedy match inside brackets
      .replace(/^\s*Translation:.*$/gm, '') // Match "Translation:" only at the start of a line (potentially after whitespace)
      .trim();
  }

  static async generateChatCompletion(
    messages: ChatMessage[],
    scenario: Scenario,
    target_language: string
  ) {
    try {
      // Ensure messages exist and are in the correct format before mapping
       if (!Array.isArray(messages)) {
          console.error("generateChatCompletion: Invalid messages array provided", messages);
          messages = []; // Default to empty array if invalid
       }

      const formattedMessages = [
        {
          role: 'system',
          content: `You are ${scenario.persona.name}, a ${scenario.persona.role}.
                   Personality: ${scenario.persona.personality}
                   Context: ${scenario.description}
                   IMPORTANT:
                   - Always respond ONLY in ${target_language}
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
                   - User messages are in English (provided as 'original' content)
                   - Your responses must be only in ${target_language}
                   - Never include translations or English text
                   - Maintain conversation context and consistency`
        },
        // Filter out any potentially null/invalid messages before mapping
        ...messages.filter(msg => msg && msg.content && msg.sender).map(msg => ({
          role: msg.sender === 'user' ? 'user' : 'assistant',
          // *** CHANGE: Send original content for both user and assistant for context ***
          // The prompt instructs the AI about the languages.
          content: msg.content.original
        }))
      ];

      console.log("Sending messages to OpenAI:", JSON.stringify(formattedMessages, null, 2)); // Log the payload

      const response = await api.post('', {
        model: Config.MODEL,
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 150,
        presence_penalty: 0.6,
        frequency_penalty: 0.5
      });

      console.log("OpenAI API Raw Response:", JSON.stringify(response.data, null, 2)); // Log raw response

      if (!response.data?.choices?.[0]?.message?.content) {
        console.error('Invalid API response format:', response.data);
        throw new Error('Invalid API response format from OpenAI');
      }

      const rawResponse = response.data.choices[0].message.content;
      const cleaned = this.cleanResponse(rawResponse);
      console.log("Cleaned OpenAI Response:", cleaned); // Log cleaned response
      return cleaned;

    } catch (error) {
      console.error('OpenAI API error:', error);
      if (axios.isAxiosError(error)) {
        const errorDetails = error.response?.data?.error;
        const errorMessage = errorDetails?.message || 'Unknown API error';
        const errorType = errorDetails?.type;
        const errorCode = errorDetails?.code;
        console.error(`API Error Details: Type=${errorType}, Code=${errorCode}, Message=${errorMessage}`);
        // Provide more specific error messages
        if (error.response?.status === 401) {
             throw new Error(`API Error: Authentication failed. Please check your OpenAI API key.`);
        } else if (error.response?.status === 429) {
             throw new Error(`API Error: Rate limit exceeded or quota issue. Please check your OpenAI plan.`);
        } else {
            throw new Error(`API Error: ${errorMessage}`);
        }
      }
      throw new Error('Failed to generate AI response. Please try again.');
    }
  }

  static async translateText(text: string, target_language: string): Promise<string> {
     // Add a check for empty input
     if (!text || !text.trim()) {
         console.warn("translateText: Received empty text, returning empty string.");
         return "";
     }
    try {
      const response = await api.post('', {
        model: Config.MODEL, // Can use a different model optimized for translation if needed
        messages: [
          {
            role: 'system',
            content: `You are a translator. Translate the following text to ${target_language}. Respond with ONLY the translation, no explanations, no conversational filler, no brackets.`
          },
          { role: 'user', content: text }
        ],
        temperature: 0.2, // Lower temperature for more deterministic translation
        max_tokens: Math.max(100, text.length * 2) // Adjust max tokens based on input length
      });

      if (!response.data?.choices?.[0]?.message?.content) {
         console.error('Invalid translation response format:', response.data);
        throw new Error('Invalid translation response format from OpenAI');
      }

      // Apply cleaning, although ideally the prompt prevents extra text
      return this.cleanResponse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Translation error:', error);
      if (axios.isAxiosError(error)) {
         const errorDetails = error.response?.data?.error;
         const errorMessage = errorDetails?.message || 'Unknown API error';
         const errorType = errorDetails?.type;
         const errorCode = errorDetails?.code;
         console.error(`Translation API Error Details: Type=${errorType}, Code=${errorCode}, Message=${errorMessage}`);
         throw new Error(`Translation failed: ${errorMessage}`);
      }
      throw new Error('Translation failed. Please try again.');
    }
  }
}