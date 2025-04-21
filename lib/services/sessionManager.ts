// lib/services/sessionManager.ts
import { Session, ChatMessage, Scenario, Language } from "@/types"; // Added Scenario, Language
import { supabase } from "../supabase/client";
import { StorageService } from "./storage";
import { ChatService, ChatServiceResult } from "./chat";
import { EncryptionService } from "./encryption";
import NetInfo from "@react-native-community/netinfo";
import { SyncQueueService } from "./syncQueue"; // Assuming SyncQueueService is implemented elsewhere
import { Dispatch } from "react";
import { generateId } from "../utils/ids"; // Added generateId

// Keep SessionLoadError class
export class SessionLoadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SessionLoadError";
  }
}

// Define return type for loadOrCreateSession
interface LoadOrCreateResult {
  session: Session | null;
  scenario: Scenario | null;
  messages: ChatMessage[];
}

export class SessionManager {
  // Keep static properties if needed (lastSyncTime)
  private static lastSyncTime: number = 0;

  // Keep isNetworkConnected helper
  private static async isNetworkConnected(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected === true && state.isInternetReachable !== false;
    } catch (error) {
      console.warn("SessionManager: Error checking network state:", error);
      return false;
    }
  }

  // --- [NEW/MODIFIED] Function to load OR create session ---
  static async loadOrCreateSession(
    sessionId: string,
    scenarioId: string,
    userId: string,
    isNewSession: boolean,
    source_language: Language | null, // Needed for creation
    dispatch: Dispatch<any> // Keep dispatch if needed for internal loading steps (though not used in this specific logic)
  ): Promise<LoadOrCreateResult> {
    console.log(
      `\n--- DEBUG: SessionManager.loadOrCreateSession START - SessionID: ${sessionId}, ScenarioID: ${scenarioId}, isNew: ${isNewSession} ---\n`
    );
    let fetchedScenario: Scenario | null = null;

    // 1. Fetch Scenario details (always needed)
    try {
      console.log(`DEBUG: Fetching scenario details for ${scenarioId}`);
      const { data: scenarioData, error: scenarioError } = await supabase
        .from("scenarios")
        .select("*")
        .eq("id", scenarioId)
        .single(); // Expecting one scenario

      if (scenarioError) throw scenarioError;
      if (!scenarioData)
        throw new Error(`Scenario with ID ${scenarioId} not found.`);
      // Simple transformation if needed, or assume structure matches Scenario type
      fetchedScenario = scenarioData as Scenario;
      console.log(
        `DEBUG: Successfully fetched scenario: ${fetchedScenario?.title}`
      );
    } catch (error) {
      console.error(
        `SessionManager: CRITICAL - Failed to fetch scenario ${scenarioId}:`,
        error
      );
      // Cannot proceed without scenario details
      return { session: null, scenario: null, messages: [] };
    }

    // --- Logic based on isNewSession ---
    if (isNewSession) {
      // --- CREATE NEW SESSION ---
      console.log(`DEBUG: Creating new session object for ID ${sessionId}`);
      if (!source_language || !fetchedScenario.target_language) {
        console.error(
          "SessionManager: Cannot create new session - missing source or target language."
        );
        return { session: null, scenario: fetchedScenario, messages: [] }; // Return scenario if fetched
      }
      const now = Date.now();
      const newSession: Session = {
        id: sessionId, // Use the generated ID passed from ScenariosScreen
        userId: userId,
        scenarioId: scenarioId,
        target_language: fetchedScenario.target_language,
        source_language: source_language,
        messages: [],
        startTime: now,
        lastUpdated: now,
        scenario: fetchedScenario, // Embed fetched scenario
        status: "active",
      };

      try {
        // Save metadata locally immediately
        await StorageService.saveSessionMetadata(newSession);
        console.log(
          `DEBUG: Saved metadata locally for new session ${sessionId}`
        );

        // Attempt to save the shell to Supabase (fire and forget or handle error)
        console.log(
          `DEBUG: Attempting initial Supabase save for new session ${sessionId}`
        );
        // Pass empty array for messages as there are none yet
        ChatService.createOrUpdateSession(newSession, [])
          .then((result) => {
            if (result.success) {
              console.log(
                `DEBUG: Initial Supabase save successful for new session ${sessionId}`
              );
            } else {
              console.warn(
                `DEBUG: Initial Supabase save failed for new session ${sessionId}:`,
                result.error
              );
              // Optionally queue for later sync if needed using SyncQueueService
              // SyncQueueService.addToQueue({ type: 'session', data: newSession, priority: 5, sessionId: sessionId });
            }
          })
          .catch((err) => {
            console.warn(
              `DEBUG: Initial Supabase save threw error for new session ${sessionId}:`,
              err
            );
            // Optionally queue for later sync if needed
            // SyncQueueService.addToQueue({ type: 'session', data: newSession, priority: 5, sessionId: sessionId });
          });

        console.log(
          `\n--- DEBUG: SessionManager.loadOrCreateSession END (Created New) - SessionID: ${sessionId} ---\n`
        );
        return { session: newSession, scenario: fetchedScenario, messages: [] };
      } catch (error) {
        console.error(
          `SessionManager: Error during new session creation storage/sync for ${sessionId}:`,
          error
        );
        // Return what we have, ChatScreen might handle this
        return { session: newSession, scenario: fetchedScenario, messages: [] };
      }
    } else {
      // --- LOAD EXISTING SESSION ---
      console.log(`DEBUG: Loading existing session ${sessionId}`);
      let localSessionData: Session | null = null;
      let localMessages: ChatMessage[] = [];
      let loadedSession: Session | null = null;
      let loadedMessages: ChatMessage[] = [];

      // 1. Load local data first (as fallback and for comparison)
      try {
        console.log(
          `DEBUG: SessionManager.loadOrCreateSession - Attempting local load...`
        );
        // --- [FIX] Use loadSession to get metadata + messages from storage ---
        const sessionFromStorage = await StorageService.loadSession(sessionId);
        if (sessionFromStorage) {
          localSessionData = sessionFromStorage; // Contains metadata
          localMessages = sessionFromStorage.messages || []; // Contains messages loaded by loadSession
        }
        // --- End Fix ---
        console.log(
          `DEBUG: SessionManager.loadOrCreateSession - Local load result: ${
            localSessionData ? "Found" : "Not Found"
          }. Messages: ${localMessages.length}. LastUpdated: ${
            localSessionData?.lastUpdated
          }`
        );
      } catch (localError) {
        console.warn(
          `SessionManager: Error loading local session ${sessionId}:`,
          localError
        );
      }

      // 2. Attempt to load from Supabase if network is available
      if (await this.isNetworkConnected()) {
        try {
          console.log(
            `DEBUG: SessionManager.loadOrCreateSession - Network available, attempting remote load...`
          );
          const {
            session: remoteSessionData,
            messages: remoteEncryptedMessages,
          } = await ChatService.fetchSessionWithMessages(sessionId, userId);
          console.log(
            `DEBUG: SessionManager.loadOrCreateSession - Remote load result: ${
              remoteSessionData ? "Found" : "Not Found"
            }. Encrypted Messages: ${
              remoteEncryptedMessages?.length ?? 0
            }. LastUpdated: ${remoteSessionData?.lastUpdated}`
          );

          if (remoteSessionData && remoteEncryptedMessages) {
            const decryptStartTime = Date.now();
            console.log(
              `DEBUG: SessionManager.loadOrCreateSession - Starting remote message decryption at ${new Date(
                decryptStartTime
              ).toISOString()}...`
            );

            const decryptedMessages = await Promise.all(
              remoteEncryptedMessages.map(async (msg) => {
                try {
                  if (EncryptionService.isEncryptedMessage(msg)) {
                    console.log(
                      `DEBUG: SessionManager - Starting decryption for message ${msg.id}`
                    );
                    const decrypted = await EncryptionService.decryptChatMessage(
                      msg,
                      userId
                    );
                    console.log(
                      `DEBUG: SessionManager - Finished decryption for message ${msg.id}`
                    );
                    return decrypted;
                  }
                  console.log(
                    `DEBUG: SessionManager - Skipping decryption for message ${msg.id} (not encrypted)`
                  );
                  return msg;
                } catch (decryptError) {
                  console.error(
                    `SessionManager: Error decrypting remote message ${msg.id} for session ${sessionId}:`,
                    decryptError
                  );
                  console.error(
                    `DEBUG: Message decryption failed - ID: ${msg.id}`
                  );
                  return msg; // Return original on error for now
                }
              })
            );

            const decryptEndTime = Date.now();
            console.log(
              `DEBUG: SessionManager.loadOrCreateSession - Remote message decryption finished at ${new Date(
                decryptEndTime
              ).toISOString()}.`
            );
            console.log(
              `DEBUG: Decryption stats - Total time: ${
                decryptEndTime - decryptStartTime
              }ms, Original message count: ${
                remoteEncryptedMessages.length
              }, Resulting message count: ${decryptedMessages.length}`
            );

            loadedMessages = decryptedMessages.filter(
              (msg) => msg !== null
            ) as ChatMessage[];
            console.log(
              `DEBUG: SessionManager.loadOrCreateSession - Remote message decryption finished. Valid messages: ${loadedMessages.length}`
            );

            // Combine remote session data with fetched scenario
            loadedSession = {
              ...remoteSessionData,
              scenario: fetchedScenario, // Attach the scenario fetched earlier
              messages: [], // Messages handled separately in return value
            };

            // Cache the successfully loaded and decrypted data locally
            try {
              await StorageService.saveChatHistory(
                sessionId,
                loadedMessages,
                false
              ); // Save decrypted
              await StorageService.saveSessionMetadata({
                ...loadedSession,
                messages: [],
              }); // Save metadata without messages
              console.log(
                `SessionManager: Cached session ${sessionId} data locally from Supabase.`
              );
            } catch (cacheError) {
              /* ... warning ... */
            }

            console.log(
              `\n--- DEBUG: SessionManager.loadOrCreateSession END (Remote Load) - SessionID: ${sessionId} ---\n`
            );
            return {
              session: loadedSession,
              scenario: fetchedScenario,
              messages: loadedMessages,
            };
          } else {
            console.log(
              `DEBUG: SessionManager.loadOrCreateSession - Session ${sessionId} not found or empty in Supabase.`
            );
          }
        } catch (remoteError) {
          console.warn(
            `SessionManager: Error loading session ${sessionId} from Supabase:`,
            remoteError
          );
        }
      } else {
        console.log(
          `DEBUG: SessionManager.loadOrCreateSession - Network unavailable, using local only.`
        );
      }

      // 3. Use Local Storage Data if Supabase failed or network unavailable
      if (localSessionData) {
        console.log(
          `DEBUG: SessionManager.loadOrCreateSession - Using local data for session ${sessionId}.`
        );
        console.log(
          `DEBUG: SessionManager.loadOrCreateSession - Starting local message decryption...`
        );
        const decryptedMessages = await Promise.all(
          localMessages.map(async (msg) => {
            try {
              if (EncryptionService.isEncryptedMessage(msg)) {
                console.log(
                  `DEBUG: SessionManager - Starting decryption for local message ${msg.id}`
                );
                const decrypted = await EncryptionService.decryptChatMessage(
                  msg,
                  userId
                );
                console.log(
                  `DEBUG: SessionManager - Finished decryption for local message ${msg.id}`
                );
                return decrypted;
              }
              console.log(
                `DEBUG: SessionManager - Skipping decryption for local message ${msg.id} (not encrypted)`
              );
              return msg;
            } catch (decryptError) {
              console.error(
                `SessionManager: Error decrypting local message ${msg.id} for session ${sessionId}:`,
                decryptError
              );
              // Attempt key recovery logic if needed
              // const { data: { user } } = await supabase.auth.getUser();
              // if (user && user.email) {
              //   try {
              //     const recoverySuccess = await EncryptionService.attemptKeyRecovery(user.id, user.email);
              //     if (recoverySuccess) {
              //       console.log(`SessionManager: Key recovery successful for user ${userId}, retrying decryption for message ${msg.id}`);
              //       return await EncryptionService.decryptChatMessage(msg, userId);
              //     }
              //   } catch (recoveryError) {
              //     console.error("SessionManager: Key recovery failed during local load:", recoveryError);
              //   }
              // }
              return msg; // Return original on error / failed recovery
            }
          })
        );
        console.log(
          `DEBUG: SessionManager.loadOrCreateSession - Local message decryption finished. Valid messages: ${decryptedMessages.length}`
        );

        // Combine local session data with fetched scenario
        loadedSession = {
          ...localSessionData,
          scenario: fetchedScenario, // Attach the scenario fetched earlier
          messages: [], // Messages handled separately in return value
        };

        console.log(
          `\n--- DEBUG: SessionManager.loadOrCreateSession END (Local Load) - SessionID: ${sessionId} ---\n`
        );
        return {
          session: loadedSession,
          scenario: fetchedScenario,
          messages: decryptedMessages, // Fixed: was using loadedMessages which might be empty
        };
      } else {
        // Failed locally and remotely/offline
        console.error(
          `DEBUG: SessionManager.loadOrCreateSession - No session data found locally or remotely for ${sessionId}.`
        );
        console.log(
          `\n--- DEBUG: SessionManager.loadOrCreateSession END (Error) - SessionID: ${sessionId} ---\n`
        );
        throw new SessionLoadError(
          `Session ${sessionId} could not be loaded. No data found locally and Supabase unreachable/empty.`
        );
      }
    } // End LOAD EXISTING SESSION
  } // End loadOrCreateSession

  // --- Keep existing handleSessionUpdate ---
  // Ensure it uses shouldEncrypt = false if messages are already encrypted before calling
  static async handleSessionUpdate(
    session: Session,
    messages: ChatMessage[],
    shouldEncrypt = true // Default might be true, but ChatScreen should pass false now if pre-encrypted
  ) {
    if (!session || !session.id) {
      console.error(
        "SessionManager: Invalid session provided to handleSessionUpdate"
      );
      return;
    }
    console.log(`SessionManager: Handling update for session ${session.id}`, {
      messageCount: messages.length,
      shouldEncrypt,
      status: session.status,
    });
    let messagesToSaveLocally = messages;

    // --- Local Save First ---
    try {
      if (shouldEncrypt) {
        console.log(
          `SessionManager: Encrypting ${messages.length} messages for local save (shouldEncrypt=true).`
        );
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user?.id) {
          await EncryptionService.ensureEncryptionKey(user.id, user.email); // Ensure key exists
          messagesToSaveLocally = await Promise.all(
            messages.map(async (msg) => {
              // Check if it's *already* encrypted to avoid double encryption
              if (!EncryptionService.isEncryptedMessage(msg)) {
                return await EncryptionService.encryptChatMessage(msg, user.id);
              }
              return msg; // Already encrypted, keep as is
            })
          );
        } else {
          console.warn(
            `SessionManager: No user found, cannot encrypt messages for local save in session ${session.id}. Saving unencrypted.`
          );
          messagesToSaveLocally = messages; // Save unencrypted if no user
        }
      } else {
        console.log(
          `SessionManager: Saving ${messagesToSaveLocally.length} messages locally without further encryption (shouldEncrypt=false).`
        );
      }

      // Save messages (potentially encrypted or passed as already encrypted)
      // Pass false to saveChatHistory because we handled encryption here if needed
      await StorageService.saveChatHistory(
        session.id,
        messagesToSaveLocally,
        false
      );

      // Save session metadata (always without messages embedded)
      const sessionMetadata = {
        ...session,
        messages: [], // Ensure messages aren't stored in metadata object
        lastUpdated: Date.now(),
      };
      await StorageService.saveSessionMetadata(sessionMetadata);

      console.log(
        `SessionManager: Successfully saved session ${session.id} locally.`
      );
    } catch (localSaveError) {
      console.error(
        `SessionManager: CRITICAL - Failed to save session ${session.id} locally:`,
        localSaveError
      );
      // Decide if you want to queue sync even if local save fails
      // Could add to SyncQueue here as a fallback if necessary
    }

    // --- Sync Responsibility Moved ---
    // No sync logic here anymore. ChatScreen or other callers will trigger sync explicitly.
    console.log(
      `SessionManager: Local update handled for ${session.id}. Sync responsibility lies elsewhere.`
    );
  }

  // --- Keep existing handleSessionEnd ---
  // Ensure it handles encryption correctly before syncing
  static async handleSessionEnd(
    session: Session,
    messages: ChatMessage[],
    markAsCompleted: boolean,
    isProcessingMessage: boolean | undefined // Keep this flag if needed
  ) {
    if (!session || !session.id) {
      console.error(
        "SessionManager: Invalid session provided to handleSessionEnd"
      );
      return;
    }
    const finalStatus = markAsCompleted ? "completed" : "saved";
    console.log(
      `SessionManager: Ending session ${session.id} with status ${finalStatus}`,
      {
        messageCount: messages.length,
        isProcessingMessage: isProcessingMessage, // Log the value received
      }
    );

    const updatedSession: Session = {
      ...session,
      // messages: messages, // Keep messages for potential encryption/sync - removed, handle below
      status: finalStatus,
      lastUpdated: Date.now(),
    };
    let messagesForSync = messages; // Messages to potentially send to Supabase

    // --- Local Save (Always attempt this) ---
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        await EncryptionService.ensureEncryptionKey(user.id, user.email);
        // Encrypt messages ONLY IF they aren't already encrypted
        messagesForSync = await Promise.all(
          messages.map(async (msg) => {
            if (!EncryptionService.isEncryptedMessage(msg)) {
              console.log(
                `SessionManager: Encrypting message ${msg.id} for final save/sync.`
              );
              return await EncryptionService.encryptChatMessage(msg, user.id);
            }
            return msg; // Already encrypted
          })
        );
        console.log(
          `SessionManager: Ensured ${messagesForSync.length} messages are encrypted for final save/sync.`
        );
      } else {
        console.warn(
          `SessionManager: No user found, cannot ensure final messages are encrypted for session ${session.id}.`
        );
        messagesForSync = messages; // Use potentially unencrypted messages
      }

      // Save encrypted messages locally
      await StorageService.saveChatHistory(session.id, messagesForSync, false); // false = we handled encryption

      // Save final metadata locally (without messages embedded)
      await StorageService.saveSessionMetadata({
        ...updatedSession,
        messages: [],
      });
      console.log(
        `SessionManager: Successfully saved final state for session ${session.id} locally.`
      );
    } catch (localSaveError) {
      console.error(
        `SessionManager: CRITICAL - Failed to save final state for session ${session.id} locally:`,
        localSaveError
      );
      // Still proceed to attempt sync
    }

    // --- Supabase Sync (Attempt Immediately ONLY IF NOT processing message) ---
    if (isProcessingMessage === true) {
      console.log(
        `SessionManager: Skipping immediate final sync for ${session.id} because isProcessingMessage is true.`
      );
      // Rely on sync being called later (e.g., after AI response finishes and ChatScreen calls sync)
    } else {
      console.log(
        `SessionManager: Proceeding with immediate final sync for ${session.id}.`
      );
      try {
        // Pass the session state *with* the encrypted messages for syncing
        const sessionForSync = { ...updatedSession, messages: messagesForSync };
        await this.syncToSupabase(sessionForSync, true); // true = force immediate attempt if online
        this.lastSyncTime = Date.now();
      } catch (syncError) {
        console.error(
          `SessionManager: Final sync failed for session ${session.id} (error handled/queued by syncToSupabase):`,
          syncError
        );
        // syncToSupabase should handle queueing on failure
      }
    }
  }

  // --- Keep existing syncToSupabase ---
  // Make sure it uses the correct message format (likely encrypted)
  static async syncToSupabase(session: Session, forceImmediateAttempt = false) {
    if (!session || !session.id) {
      console.error(
        "SessionManager: Invalid session provided to syncToSupabase"
      );
      throw new Error("Invalid session for sync");
    }
    console.log(
      `SessionManager: Attempting to sync session ${session.id} to Supabase (Force: ${forceImmediateAttempt})`
    );

    // Ensure messages exist and are encrypted before syncing
    let messagesToSync = session.messages || [];

    // Double-check encryption (belt and suspenders)
    if (messagesToSync.length > 0) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.id) {
        // Ensure key exists in case it wasn't available during previous steps
        await EncryptionService.ensureEncryptionKey(user.id, user.email).catch(
          (err) => console.warn("Failed to ensure key during sync:", err)
        );
        messagesToSync = await Promise.all(
          messagesToSync.map(async (msg) => {
            if (!EncryptionService.isEncryptedMessage(msg)) {
              console.warn(
                `SessionManager: Encrypting message ${msg.id} on the fly for sync.`
              );
              try {
                return await EncryptionService.encryptChatMessage(msg, user.id);
              } catch (encError) {
                console.error(
                  `SessionManager: Failed to encrypt message ${msg.id} during sync attempt. Sending unencrypted.`,
                  encError
                );
                return msg; // Send unencrypted as last resort? Or skip? Decide policy.
              }
            }
            return msg;
          })
        );
      } else {
        console.warn(
          `SessionManager: Cannot ensure message encryption for sync - user not found. Messages might be unencrypted.`
        );
      }
    } else {
      console.log(
        `SessionManager: No messages provided in session object for sync ${session.id}. Assuming messages are handled separately or none exist.`
      );
      // If messages *should* always be present, maybe load from storage here?
      // const storedMessages = await StorageService.loadChatHistory(session.id); // Potentially load if messages array is empty
      // messagesToSync = storedMessages // Then re-run encryption check
    }

    // Reconstruct session object with potentially re-encrypted/loaded messages
    const sessionForSync = { ...session, messages: messagesToSync };

    // --- Network Check & Queueing Logic ---
    if (!(await this.isNetworkConnected())) {
      if (forceImmediateAttempt) {
        console.error(
          `SessionManager: Network unavailable. Forced immediate sync failed for session ${session.id}.`
        );
        throw new Error("Network unavailable for forced sync.");
      }
      console.warn(
        `SessionManager: Network unavailable. Queuing sync for session ${session.id}.`
      );
      try {
        await SyncQueueService.addToQueue({
          type: "session",
          data: sessionForSync, // Queue the session with potentially encrypted messages
          priority: sessionForSync.status === "completed" ? 10 : 5, // Higher priority for completed sessions
          sessionId: session.id,
        });
        console.log(
          `SessionManager: Successfully queued sync for session ${session.id}.`
        );
      } catch (queueError) {
        console.error(
          `SessionManager: Failed to add session ${session.id} to sync queue:`,
          queueError
        );
        // Throw or handle queueing failure
        throw new Error(`Failed to queue sync for session ${session.id}`);
      }
      return; // Exit after queueing
    }

    // --- Attempt Sync via ChatService ---
    try {
      let result: ChatServiceResult;
      // Use the session object that includes the messages ensured to be encrypted
      if (sessionForSync.status === "completed") {
        result = await ChatService.completeSession(
          sessionForSync.id,
          sessionForSync.messages
        );
      } else {
        result = await ChatService.createOrUpdateSession(
          sessionForSync,
          sessionForSync.messages
        );
      }

      if (result.success) {
        console.log(
          `SessionManager: Successfully synced session ${session.id} with ${messagesToSync.length} messages to Supabase.`
        );
        // Optional: Remove from queue if it was previously queued
        // await SyncQueueService.removeCompletedItem(session.id);
      } else {
        console.error(
          `SessionManager: Supabase sync failed for session ${session.id}:`,
          result.error
        );
        // Add to queue for retry even though network is available (server error, etc.)
        try {
          await SyncQueueService.addToQueue({
            type: "session",
            data: sessionForSync,
            priority: 8, // High priority for retry
            sessionId: session.id,
          });
          console.log(
            `SessionManager: Queued failed sync for session ${session.id} for retry.`
          );
        } catch (queueError) {
          console.error(
            `SessionManager: Failed to queue session ${session.id} after sync failure:`,
            queueError
          );
        }
        throw result.error || new Error("Supabase sync failed");
      }
    } catch (error) {
      console.error(
        `SessionManager: Error during Supabase sync attempt for session ${session.id}:`,
        error
      );
      // Add to queue if not already added or if it's a network error during the attempt
      try {
        // Avoid double-queueing if error came from queue service itself
        if (!(error instanceof Error && error.message.includes("queue"))) {
          await SyncQueueService.addToQueue({
            type: "session",
            data: sessionForSync,
            priority: 8,
            sessionId: session.id,
          });
          console.log(
            `SessionManager: Queued session ${session.id} after sync exception.`
          );
        }
      } catch (queueError) {
        console.error(
          `SessionManager: Failed to queue session ${session.id} after sync exception:`,
          queueError
        );
      }
      throw error; // Re-throw the original error
    }
  }

  // --- Keep existing cleanup method ---
  static async cleanup(userId: string) {
    console.log(`SessionManager: Cleaning up session data for user ${userId}`);
    try {
      // Clear encryption key first
      await EncryptionService.removeEncryptionKey(userId);
      console.log(`SessionManager: Removed encryption key for user ${userId}.`);

      // Clear any related local storage (implement this in StorageService)
      await StorageService.clearUserData(userId); // Assuming this clears sessions, messages etc.
      console.log(
        `SessionManager: Cleared local storage data for user ${userId}.`
      );

      // Reset last sync time if relevant
      this.lastSyncTime = 0;

      console.log(`SessionManager: Cleanup completed for user ${userId}`);
    } catch (error) {
      console.error(
        `SessionManager: Error during cleanup for user ${userId}:`,
        error
      );
      // Decide if this error should be propagated
      throw error; // Re-throw error after logging
    }
  }
}