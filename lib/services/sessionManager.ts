// lib/services/sessionManager.ts
import { Session, ChatMessage } from '@/types';
import { supabase } from '../supabase/client';
import { StorageService } from './storage';

export class SessionManager {
  private static debounceTimeout: NodeJS.Timeout | null = null;
  private static lastSyncTime: number = 0;
  private static SYNC_INTERVAL = 5000; // 5 seconds

  static async handleSessionUpdate(session: Session, messages: ChatMessage[]) {
    try {
      // Always save locally immediately
      await StorageService.saveChatHistory(session.id, messages);

      // Debounce Supabase updates
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }

      this.debounceTimeout = setTimeout(async () => {
        const now = Date.now();
        if (now - this.lastSyncTime >= this.SYNC_INTERVAL) {
          await this.syncToSupabase(session, messages);
          this.lastSyncTime = now;
        }
      }, 1000);

    } catch (error) {
      console.error('Session update error:', error);
    }
  }

  static async syncToSupabase(session: Session, messages: ChatMessage[]) {
    try {
      const metrics = this.calculateMetrics(session, messages);
      
      await supabase
        .from('chat_sessions')
        .upsert({
          id: session.id,
          user_id: session.userId,
          scenario_id: session.scenarioId,
          messages,
          metrics,
          status: session.status,
          updated_at: new Date().toISOString()
        });

    } catch (error) {
      console.error('Supabase sync error:', error);
      // Will retry on next sync interval
    }
  }

  static async handleSessionEnd(session: Session, messages: ChatMessage[]) {
    try {
      // Clear any pending debounce
      if (this.debounceTimeout) {
        clearTimeout(this.debounceTimeout);
      }

      // Final save to both storages
      await Promise.all([
        StorageService.saveChatHistory(session.id, messages),
        this.syncToSupabase(session, messages)
      ]);

    } catch (error) {
      console.error('Session end error:', error);
    }
  }

  private static calculateMetrics(session: Session, messages: ChatMessage[]) {
    return {
      messageCount: messages.length,
      userMessageCount: messages.filter(m => m.sender === 'user').length,
      assistantMessageCount: messages.filter(m => m.sender === 'assistant').length,
      duration: Math.floor((Date.now() - session.startTime) / 1000),
      lastUpdated: new Date().toISOString()
    };
  }
}