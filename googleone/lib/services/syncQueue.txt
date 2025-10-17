// lib/services/syncQueue.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../supabase/client';
import { Session, ChatMessage } from '@/types';
const MAX_QUEUE_SIZE = 100; // Set reasonable queue size limit


const SYNC_QUEUE_KEY = '@sync_queue';
const SYNC_TRACKING_KEY = '@sync_tracking';

const MAX_RETRIES = 5;
const RETRY_INTERVALS = [5000, 15000, 30000, 60000, 120000]; // Increasing backoff

interface SyncQueueItem {
  id: string;
  type: 'session' | 'message';
  data: any;
  priority: number; // Higher = more important
  retries: number;
  lastAttempt: number;
  sessionId: string;
  contentHash: string;

}
interface SyncTrackingData {
    sessionMessageSyncs: Record<string, number>; // sessionId -> timestamp
    sessionSyncs: Record<string, number>; // sessionId -> timestamp
    lastCleanup: number;
  }

export class SyncQueueService {
    private static queue: SyncQueueItem[] = [];
    private static isProcessing = false;
    private static syncTimer: NodeJS.Timeout | null = null;
    private static syncTracking: SyncTrackingData = {
      sessionMessageSyncs: {},
      sessionSyncs: {},
      lastCleanup: Date.now()
    };
    private static initialized = false;
  
  // Initialize queue from storage
  static async init() {
    if (this.initialized) return; // Prevent multiple initializations
    
    console.log('SyncQueue: Initializing...');
    try {
      // Load sync tracking data first
      const trackingData = await AsyncStorage.getItem(SYNC_TRACKING_KEY);
      if (trackingData) {
        this.syncTracking = JSON.parse(trackingData);
        console.log('SyncQueue: Loaded sync tracking data');
      }
      
      // Clear old tracking data (older than 1 hour)
      await this.cleanupOldTrackingData();
      
      // Load queue data
      const queueData = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
      if (queueData) {
        this.queue = JSON.parse(queueData);
        console.log(`SyncQueue: Loaded ${this.queue.length} pending items`);
        
        // Truncate queue if it's too large
        if (this.queue.length > MAX_QUEUE_SIZE) {
          console.log(`SyncQueue: Truncating queue from ${this.queue.length} to ${MAX_QUEUE_SIZE} items`);
          // Keep high priority items, then recent items
          this.queue.sort((a, b) => 
            (b.priority - a.priority) || (b.lastAttempt - a.lastAttempt)
          );
          this.queue = this.queue.slice(0, MAX_QUEUE_SIZE);
          await this.saveQueue();
        }
        
        this.startProcessing();
      }
      
      this.initialized = true;
    } catch (error) {
      console.error('SyncQueue: Init error:', error);
    }
  }
  private static async cleanupOldTrackingData() {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;
    
    // Only run cleanup once per hour
    if (now - this.syncTracking.lastCleanup < ONE_HOUR) {
      return;
    }
    
    try {
      // Remove tracking older than 1 hour
      for (const sessionId in this.syncTracking.sessionMessageSyncs) {
        if (now - this.syncTracking.sessionMessageSyncs[sessionId] > ONE_HOUR) {
          delete this.syncTracking.sessionMessageSyncs[sessionId];
        }
      }
      
      for (const sessionId in this.syncTracking.sessionSyncs) {
        if (now - this.syncTracking.sessionSyncs[sessionId] > ONE_HOUR) {
          delete this.syncTracking.sessionSyncs[sessionId];
        }
      }
      
      this.syncTracking.lastCleanup = now;
      await AsyncStorage.setItem(SYNC_TRACKING_KEY, JSON.stringify(this.syncTracking));
      console.log('SyncQueue: Cleaned up old tracking data');
    } catch (error) {
      console.error('SyncQueue: Error cleaning up tracking data:', error);
    }
  }
  
  // Add item to queue
  static async addToQueue(item: Omit<SyncQueueItem, 'id' | 'retries' | 'lastAttempt' | 'contentHash'>) {
    // Initialize if not already done
    if (!this.initialized) {
      await this.init();
    }
    
    // Check if this is a duplicate sync request based on tracking data
    const now = Date.now();
    const THROTTLE_WINDOW = 10000; // 10 seconds
    
    // Check against tracking data first (much faster than checking queue)
    if (item.type === 'message') {
      const lastSync = this.syncTracking.sessionMessageSyncs[item.sessionId] || 0;
      if (now - lastSync < THROTTLE_WINDOW) {
        console.log(`SyncQueue: Throttling message sync for session ${item.sessionId}, last sync was ${(now - lastSync)/1000}s ago`);
        return `throttled_${now}`;
      }
      
      // Update tracking
      this.syncTracking.sessionMessageSyncs[item.sessionId] = now;
    } else if (item.type === 'session') {
      const lastSync = this.syncTracking.sessionSyncs[item.sessionId] || 0;
      if (now - lastSync < THROTTLE_WINDOW) {
        console.log(`SyncQueue: Throttling session sync for session ${item.sessionId}, last sync was ${(now - lastSync)/1000}s ago`);
        return `throttled_${now}`;
      }
      
      // Update tracking
      this.syncTracking.sessionSyncs[item.sessionId] = now;
    }
    
    // Save updated tracking data
    await AsyncStorage.setItem(SYNC_TRACKING_KEY, JSON.stringify(this.syncTracking));
    
    // Generate a content hash for deduplication
    // For messages, we just use the length to avoid stringifying large objects
    const contentHash = item.type === 'message'
      ? `${item.type}_${item.sessionId}_${Array.isArray(item.data) ? item.data.length : 'NA'}`
      : `${item.type}_${item.sessionId}`;
    
    // Check for duplicates in queue (same type, sessionId, and contentHash)
    const duplicate = this.queue.find(queueItem => 
      queueItem.type === item.type && 
      queueItem.sessionId === item.sessionId &&
      queueItem.contentHash === contentHash
    );
    
    if (duplicate) {
      console.log(`SyncQueue: Duplicate item skipped: ${contentHash}`);
      return duplicate.id;
    }
    
    // Create queue item with additional tracking
    const queueItem: SyncQueueItem = {
      ...item,
      id: `${item.type}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      retries: 0,
      lastAttempt: 0,
      contentHash
    };
    
    // Check if queue is too large and prune if needed
    if (this.queue.length >= MAX_QUEUE_SIZE) {
      // Sort by priority and remove lowest priority
      this.queue.sort((a, b) => a.priority - b.priority);
      this.queue.shift(); // Remove lowest priority item
      console.log('SyncQueue: Queue full, removed lowest priority item');
    }
    
    console.log(`SyncQueue: Adding item ${queueItem.id} (${queueItem.type}) for session ${queueItem.sessionId}`);
    this.queue.push(queueItem);
    await this.saveQueue();
    this.startProcessing();
    
    return queueItem.id;
  }
  
  // Save queue to persistent storage
  private static async saveQueue() {
    try {
      await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('SyncQueue: Error saving queue:', error);
    }
  }
  
  // Start processing queue if not already running
  private static startProcessing() {
    if (this.isProcessing) return;
    
    console.log('SyncQueue: Starting queue processing');
    this.isProcessing = true;
    this.processQueue();
  }
  
  // Process queue items
  private static async processQueue() {
    if (this.queue.length === 0) {
      console.log('SyncQueue: Queue empty, stopping processor');
      this.isProcessing = false;
      return;
    }
    
    // Check network connectivity
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('SyncQueue: No network connection, delaying processing');
      this.scheduleNextProcessing(30000); // Try again in 30 seconds
      return;
    }
    
    // Sort by priority and retry count
    this.queue.sort((a, b) => {
      // Higher priority first, fewer retries first
      return (b.priority - a.priority) || (a.retries - b.retries);
    });
    
    // Get the next item to process
    const item = this.queue[0];
    
    // Check if we should retry yet
    const now = Date.now();
    if (item.retries > 0) {
      const retryInterval = RETRY_INTERVALS[Math.min(item.retries - 1, RETRY_INTERVALS.length - 1)];
      if (now - item.lastAttempt < retryInterval) {
        console.log(`SyncQueue: Too soon to retry item ${item.id}, waiting ${retryInterval}ms`);
        this.scheduleNextProcessing(retryInterval - (now - item.lastAttempt));
        return;
      }
    }
    
    // Process the item
    console.log(`SyncQueue: Processing item ${item.id} (${item.type}, attempt ${item.retries + 1})`);
    item.lastAttempt = now;
    
    try {
      let success = false;
      
      if (item.type === 'session') {
        success = await this.syncSession(item.data);
      } else if (item.type === 'message') {
        success = await this.syncMessages(item.sessionId, item.data);
      }
      
      if (success) {
        console.log(`SyncQueue: Successfully processed item ${item.id}`);
        this.queue.shift(); // Remove the processed item
        await this.saveQueue();
        this.processNextItem();
      } else {
        item.retries++;
        
        if (item.retries >= MAX_RETRIES) {
          console.error(`SyncQueue: Max retries reached for item ${item.id}, removing from queue`);
          this.queue.shift();
        }
        
        await this.saveQueue();
        this.scheduleNextProcessing(5000); // Wait before trying next item
      }
    } catch (error) {
      console.error(`SyncQueue: Error processing item ${item.id}:`, error);
      item.retries++;
      await this.saveQueue();
      this.scheduleNextProcessing(5000);
    }
  }
  
  private static async syncSession(session: Session): Promise<boolean> {
    try {
      console.log(`SyncQueue: Syncing session ${session.id} to Supabase`);
      
      // Create a clean version of the session for Supabase
      const { data, error } = await supabase
        .from('chat_sessions')
        .upsert({
          id: session.id,
          user_id: session.userId,
          scenario_id: session.scenarioId,
          source_language: session.source_language,
          target_language: session.target_language,
          status: session.status,
          metrics: session.metrics || {},
          updated_at: new Date().toISOString(),
          created_at: new Date(session.startTime).toISOString()
        })
        .select()
        .single();
      
      if (error) {
        console.error(`SyncQueue: Supabase error syncing session ${session.id}:`, error);
        return false;
      }
      
      console.log(`SyncQueue: Successfully synced session ${session.id}`);
      return true;
    } catch (error) {
      console.error(`SyncQueue: Error syncing session ${session.id}:`, error);
      return false;
    }
  }
  
  private static async syncMessages(sessionId: string, messages: ChatMessage[]): Promise<boolean> {
    try {
      console.log(`SyncQueue: Syncing ${messages.length} messages for session ${sessionId}`);
      
      // Update the session with the messages
      const { error } = await supabase
        .from('chat_sessions')
        .update({
          messages: messages,
          updated_at: new Date().toISOString()
        })
        .eq('id', sessionId);
      
      if (error) {
        console.error(`SyncQueue: Supabase error syncing messages for session ${sessionId}:`, error);
        return false;
      }
      
      console.log(`SyncQueue: Successfully synced ${messages.length} messages for session ${sessionId}`);
      return true;
    } catch (error) {
      console.error(`SyncQueue: Error syncing messages for session ${sessionId}:`, error);
      return false;
    }
  }
  
  private static processNextItem() {
    if (this.queue.length > 0) {
      this.processQueue();
    } else {
      this.isProcessing = false;
    }
  }
  
  private static scheduleNextProcessing(delay: number) {
    if (this.syncTimer) {
      clearTimeout(this.syncTimer);
    }
    
    this.syncTimer = setTimeout(() => {
      this.processQueue();
    }, delay);
  }
  
  // Public method to force sync of all sessions
  static async syncAllSessions(userId: string) {
    const sessions = await AsyncStorage.getItem(`@user_sessions:${userId}`);
    if (!sessions) return;
    
    const sessionList: Session[] = JSON.parse(sessions);
    console.log(`SyncQueue: Force syncing ${sessionList.length} sessions for user ${userId}`);
    
    for (const session of sessionList) {
      await this.addToQueue({
        type: 'session',
        data: session,
        priority: 10,
        sessionId: session.id
      });
      
      // Add messages separately with lower priority
      await this.addToQueue({
        type: 'message',
        data: session.messages || [],
        priority: 5,
        sessionId: session.id
      });
    }
  }
}