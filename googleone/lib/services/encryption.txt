// lib/services/encryption.ts
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChatMessage } from "@/types";
// StorageService import removed to avoid cycle - if needed, pass instance or use callbacks
// import { StorageService } from "./storage";
import { supabase } from "../supabase/client";
import { Buffer } from 'buffer'; // Ensure Buffer polyfill is available

// Polyfill global Buffer if needed (some environments might require it)
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
}


export class EncryptionService {
  private static readonly KEY_PREFIX = "@encryption_key_";
  private static readonly AUTH_TYPE_KEY = "@auth_type_";

  // --- Key Management ---

  /**
   * Gets the stored encryption key for the user.
   * @param userId The ID of the user.
   * @returns The key string or null if not found or error.
   */
  static async getEncryptionKey(userId: string): Promise<string | null> {
    if (!userId) {
        console.error("EncryptionService: Cannot get key without userId.");
        return null;
    }
    try {
      return await AsyncStorage.getItem(this.KEY_PREFIX + userId);
    } catch (error) {
      console.error("Error getting key:", error);
      return null;
    }
  }

  /**
   * Generates and saves a new encryption key based on user ID, identifier (email/password/secret), and auth type.
   * @param userId The user ID.
   * @param identifier Typically email (for social) or password (for email/pass).
   * @param authType Distinguishes between password and social auth key derivation.
   * @returns The generated key string.
   * @throws If key generation or saving fails.
   */
  static async generateUserKey(
    userId: string,
    identifier: string,
    authType: "password" | "social" = "password"
  ): Promise<string> {
    if (!userId || !identifier) {
        throw new Error("User ID and identifier are required to generate a key.");
    }
    console.log(`EncryptionService: Generating ${authType} key for user ${userId}...`);
    try {
      // Store auth type for future reference (e.g., during migration)
      await AsyncStorage.setItem(`${this.AUTH_TYPE_KEY}${userId}`, authType);

      // Derive data differently based on auth type
      const data =
        authType === "social"
          ? `${userId}:${identifier}:${await this.generateSocialSecret(userId)}` // Use persistent secret for social
          : `${userId}:${identifier}`; // Use password/email directly for password auth

      // Use SHA-256 to derive the final key
      const key = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        data,
        { encoding: Crypto.CryptoEncoding.HEX } // Ensure consistent hex output
      );

      // Save the derived key
      await AsyncStorage.setItem(this.KEY_PREFIX + userId, key);
      console.log(`EncryptionService: Successfully generated and saved key for user ${userId}.`);
      return key;
    } catch (error) {
      console.error("Error generating user key:", error);
      throw error; // Re-throw error after logging
    }
  }

  /**
   * Generates or retrieves a persistent secret for social auth users.
   * This ensures the key remains the same even if the identifier (email) changes slightly but userId stays the same.
   * @param userId The user ID.
   * @returns The persistent secret string.
   * @throws If secret generation or saving fails.
   */
  private static async generateSocialSecret(userId: string): Promise<string> {
    const secretKey = `@social_secret:${userId}`;
    try {
      const existingSecret = await AsyncStorage.getItem(secretKey);
      if (existingSecret) return existingSecret;

      console.log(`EncryptionService: Generating new social secret for user ${userId}.`);
      const newSecretBytes = await Crypto.getRandomBytesAsync(32); // Generate 32 random bytes
      // Convert bytes to a hex string for storage
      const secretString = Buffer.from(newSecretBytes).toString('hex');

      await AsyncStorage.setItem(secretKey, secretString);
      return secretString;
    } catch (error) {
        console.error(`EncryptionService: Failed to generate/get social secret for ${userId}`, error);
        throw new Error("Could not generate social secret.");
    }
  }

  /**
   * Removes the encryption key and related auth type/secret info for a user.
   * @param userId The user ID.
   */
  static async removeEncryptionKey(userId: string): Promise<void> {
    if (!userId) {
        console.error("EncryptionService: Cannot remove key without userId.");
        return;
    }
    const keysToRemove = [
        this.KEY_PREFIX + userId,
        `${this.AUTH_TYPE_KEY}${userId}`,
        `@social_secret:${userId}`, // Also remove social secret if present
        `@key_status:${userId}` // Remove recovery status flag
    ];
    try {
      await AsyncStorage.multiRemove(keysToRemove);
      console.log(`EncryptionService: Removed encryption key and related data for user ${userId}.`);
    } catch (error) {
      console.error("Error removing encryption key data:", error);
      throw error; // Re-throw error after logging
    }
  }

  /**
   * **NEW FUNCTION - REQUIRED BY SessionManager/ChatService**
   * Ensures an encryption key exists for the user, attempting regeneration if needed.
   * Note: The current 'recovery' generates a NEW key, potentially orphaning old data.
   * @param userId The ID of the user.
   * @param userEmail The email of the user (required for regeneration).
   * @throws An error if a key cannot be obtained/generated.
   */
  static async ensureEncryptionKey(userId: string, userEmail?: string | null): Promise<void> {
      console.log(`EncryptionService: Ensuring key exists for user ${userId}`);
      let key = await this.getEncryptionKey(userId);

      if (!key) {
          console.warn(`EncryptionService: Key missing for ${userId}. Attempting regeneration/recovery...`);
          // Use the existing attemptKeyRecovery logic which regenerates the key
          if (!userEmail) {
              // Try fetching email if not provided
              const { data: { user } } = await supabase.auth.getUser();
              userEmail = user?.email;
          }

          if (!userEmail) {
              throw new Error("Encryption key is missing and user email is not available for key regeneration.");
          }

          // Call the existing function which regenerates (not truly recovers)
          const regenerationSuccess = await this.attemptKeyRecovery(userId, userEmail);

          if (!regenerationSuccess) {
              // If regeneration fails, throw an error.
              throw new Error("Encryption key is missing and key regeneration failed.");
          }
          // If regeneration succeeded, get the newly generated key
          key = await this.getEncryptionKey(userId);
          if (!key) {
              // This shouldn't happen if regeneration succeeded, but check just in case
              throw new Error("Encryption key is still missing after successful regeneration attempt.");
          }
          console.log(`EncryptionService: Key successfully regenerated for user ${userId}.`);
      }
      // Key exists or was regenerated
  }


  /**
   * Attempts to regenerate an encryption key if missing.
   * **WARNING:** This generates a NEW key based on current auth type and email.
   * It does NOT recover a previously lost key and will make data encrypted
   * with the old key inaccessible if the identifier (password/social secret) changed.
   * @param userId The user ID.
   * @param email The user's email.
   * @returns True if a new key was generated and saved, false otherwise.
   */
  static async attemptKeyRecovery(userId: string, email: string): Promise<boolean> {
    // This function should be named more accurately, like regenerateAndReplaceKeyIfNeeded
    if (!userId || !email) {
        console.error("attemptKeyRecovery: userId and email are required.");
        return false;
    }
    try {
      console.warn("EncryptionService: Attempting key REGENERATION (not recovery) for user:", userId);

      // Determine auth type (crucial for correct key derivation)
      let authType = await AsyncStorage.getItem(`${this.AUTH_TYPE_KEY}${userId}`) as "password" | "social" | null;

      if (!authType) {
          // If auth type isn't stored, try to infer it (less reliable)
          console.warn(`Auth type not stored for user ${userId}, attempting inference...`);
          const { data } = await supabase.auth.getUser();
          const isSocialAuth = data?.user?.app_metadata?.provider && data.user.app_metadata.provider !== 'email';
          authType = isSocialAuth ? 'social' : 'password';
          console.log("Inferred auth type for regeneration:", authType);
      }

      // Generate a NEW encryption key using the determined auth type and email as identifier
      // For password auth, this assumes the email is the identifier used during original key gen (might be wrong if password was used)
      // For social auth, it uses email + social secret (which should be stable)
      await this.generateUserKey(userId, email, authType); // This overwrites any existing key!

      // Mark that recovery/regeneration was attempted
      await AsyncStorage.setItem(`@key_status:${userId}`, 'recovered_or_regenerated');

      console.log("EncryptionService: Key regeneration successful (new key generated).");
      return true; // Indicates a key was generated/saved

    } catch (error) {
      console.error("EncryptionService: Key regeneration failed:", error);
      return false;
    }
  }


  // --- Encryption / Decryption Logic (Using XOR - **WEAK SECURITY**) ---

  // Helper to check if text appears to be encrypted using our format
  private static isEncryptedText(text: any): text is string {
    if (typeof text !== 'string') return false;
    const parts = text.split(":");
    // Format: sha256Salt(64 hex):base64Payload
    return parts.length === 2 && /^[a-f0-9]{64}$/i.test(parts[0]) && parts[1].length > 0;
  }

  // Check if message content seems encrypted
  static isEncryptedMessage(message: ChatMessage): boolean {
    try {
      const originalEncrypted = this.isEncryptedText(message.content?.original);
      const translatedEncrypted = this.isEncryptedText(message.content?.translated);
      return originalEncrypted || translatedEncrypted;
    } catch (error) {
      console.error("Error checking encryption state:", error);
      return false;
    }
  }

  // Helper methods for Base64 using Buffer (safer for Unicode)
  private static bytesToBase64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString('base64');
  }

  private static base64ToBytes(base64: string): Uint8Array {
    return Buffer.from(base64, 'base64');
  }

  /**
   * Encrypts text using XOR cipher derived from key and salt.
   * **WARNING: Cryptographically weak.** Replace with AES-GCM.
   * @param text Plaintext string.
   * @param key Master encryption key (hex string).
   * @returns Encrypted string "salt:base64(xor_result)" or original text on error/if already encrypted.
   */
  private static async encrypt(text: any, key: string): Promise<string> {
    if (typeof text !== 'string' || text === '' || this.isEncryptedText(text)) {
      return text; // Return non-strings, empty strings, or already encrypted text as is
    }
    if (!key) {
        console.error("Encryption error: Master key is missing.");
        return text; // Cannot encrypt without key
    }

    try {
      // Generate a unique salt for this encryption operation
      const saltInput = `${Date.now()}:${Math.random()}`;
      const salt = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        saltInput,
        { encoding: Crypto.CryptoEncoding.HEX }
      );

      // Derive XOR key from master key and salt
      const xorKeySource = `${key}:${salt}`;
      const xorKeyHex = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        xorKeySource,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
      // Use the raw bytes of the derived key for XORing
      const xorKeyBytes = Buffer.from(xorKeyHex, 'hex');

      // Convert plaintext to bytes
      const textBytes = Buffer.from(text, 'utf8'); // Use Buffer directly

      // Perform XOR encryption
      const encryptedBytes = Buffer.alloc(textBytes.length); // Use Buffer
      for (let i = 0; i < textBytes.length; i++) {
        encryptedBytes[i] = textBytes[i] ^ xorKeyBytes[i % xorKeyBytes.length];
      }

      // Convert encrypted bytes to Base64
      const base64Result = this.bytesToBase64(encryptedBytes);

      // Return in "salt:base64" format
      return `${salt}:${base64Result}`;
    } catch (error) {
      console.error("Encryption error:", error);
      return text; // Fallback to plaintext on error
    }
  }

  /**
   * Decrypts text encrypted with the XOR cipher.
   * **WARNING: Cryptographically weak.** Replace with AES-GCM.
   * @param encryptedText Encrypted string "salt:base64(xor_result)".
   * @param key Master encryption key (hex string).
   * @returns Decrypted string, or original string on error/invalid format.
   */
  private static async decrypt(encryptedText: any, key: string): Promise<string> {
     if (typeof encryptedText !== 'string' || !this.isEncryptedText(encryptedText)) {
       return encryptedText; // Return non-strings or non-encrypted text as is
     }
     if (!key) {
         console.error("Decryption error: Master key is missing.");
         return encryptedText; // Cannot decrypt without key
     }

     try {
       const [salt, base64Text] = encryptedText.split(":");
       // Basic validation already done by isEncryptedText

       // Re-derive XOR key from master key and salt
       const xorKeySource = `${key}:${salt}`;
       const xorKeyHex = await Crypto.digestStringAsync(
         Crypto.CryptoDigestAlgorithm.SHA256,
         xorKeySource,
         { encoding: Crypto.CryptoEncoding.HEX }
       );
       const xorKeyBytes = Buffer.from(xorKeyHex, 'hex');

       // Convert Base64 text to encrypted bytes
       const encryptedBytes = this.base64ToBytes(base64Text);

       // Perform XOR decryption
       const decryptedBytes = Buffer.alloc(encryptedBytes.length); // Use Buffer
       for (let i = 0; i < encryptedBytes.length; i++) {
         decryptedBytes[i] = encryptedBytes[i] ^ xorKeyBytes[i % xorKeyBytes.length];
       }

       // Convert decrypted bytes back to UTF-8 string
       return Buffer.from(decryptedBytes).toString('utf8'); // Use Buffer
     } catch (error) {
       console.error("Decryption error:", error);
       return encryptedText; // Fallback to encrypted text on error
     }
   }

  // --- Chat Message Encryption/Decryption ---

  /**
   * Encrypts chat message content, ensuring key exists (regenerates if needed).
   * Uses the (weak) XOR encryption internally.
   */
  static async encryptChatMessage(message: ChatMessage, userId: string): Promise<ChatMessage> {
    if (this.isEncryptedMessage(message)) return message; // Avoid double encryption

    try {
        // Ensure key exists, potentially regenerating it (see warning on attemptKeyRecovery)
        await this.ensureEncryptionKey(userId);
        const key = await this.getEncryptionKey(userId);

        if (!key) {
            console.error(`encryptChatMessage: Key unavailable for user ${userId} even after ensuring.`);
            return message; // Return original if key is definitively unavailable
        }

        // Encrypt original and translated content
        const encryptedOriginal = await this.encrypt(message.content?.original, key);
        const encryptedTranslated = await this.encrypt(message.content?.translated, key);

        return {
            ...message,
            content: {
                original: encryptedOriginal,
                translated: encryptedTranslated,
            },
        };
    } catch (error) {
        console.error(`Error encrypting chat message ${message.id}:`, error);
        return message; // Return original on error
    }
  }

  /**
   * Decrypts chat message content, ensuring key exists (regenerates if needed).
   * Uses the (weak) XOR decryption internally.
   * **WARNING:** If key was regenerated, decryption of old messages will fail silently (return encrypted text).
   */
  static async decryptChatMessage(message: ChatMessage, userId: string): Promise<ChatMessage> {
    if (!this.isEncryptedMessage(message)) return message; // Nothing to decrypt

    try {
        // Ensure key exists, potentially regenerating it (see warning on attemptKeyRecovery)
        await this.ensureEncryptionKey(userId);
        const key = await this.getEncryptionKey(userId);

        if (!key) {
            console.error(`decryptChatMessage: Key unavailable for user ${userId} even after ensuring.`);
            return message; // Return original encrypted if key is definitively unavailable
        }

        // Decrypt original and translated content
        const decryptedOriginal = await this.decrypt(message.content?.original, key);
        const decryptedTranslated = await this.decrypt(message.content?.translated, key);

        // Check if decryption actually changed the text (basic check for failed decryption with wrong key)
        // Note: This isn't foolproof for XOR if original text happened to match encrypted format
        const originalChanged = decryptedOriginal !== message.content?.original;
        const translatedChanged = decryptedTranslated !== message.content?.translated;

        if (this.isEncryptedText(message.content?.original) && !originalChanged) {
             console.warn(`Decryption might have failed for original content of message ${message.id} (key mismatch?).`);
        }
         if (this.isEncryptedText(message.content?.translated) && !translatedChanged) {
             console.warn(`Decryption might have failed for translated content of message ${message.id} (key mismatch?).`);
         }

        return {
            ...message,
            content: {
                original: decryptedOriginal,
                translated: decryptedTranslated,
            },
        };
    } catch (error) {
        console.error(`Error decrypting chat message ${message.id}:`, error);
        return message; // Return original (encrypted) on error
    }
  }


  // --- Password Change / Migration ---
  // These methods depend heavily on the StorageService structure and might need adjustment
  // They also assume the OLD key is available and correct for decryption.

  /**
   * Handles re-encryption of data when a user changes their password (for password auth).
   * Assumes the old key (derived from old password) is currently valid.
   * Requires StorageService to list sessions and load/save history.
   * @param userId User ID.
   * @param oldPassword The user's previous password.
   * @param newPassword The user's new password.
   * @throws If any step fails.
   */
  static async handlePasswordChange(userId: string, oldIdentifier: string, newIdentifier: string): Promise<void> {
     // Note: This assumes 'password' auth type and that oldIdentifier was used for the current key
     console.log(`EncryptionService: Handling password change for user ${userId}`);
     try {
       const oldKey = await this.getEncryptionKey(userId);
       if (!oldKey) {
         // Maybe the key was already regenerated? Or never existed?
         console.warn(`Old encryption key not found during password change for user ${userId}. Cannot re-encrypt.`);
         // Attempt to generate a new key with the new identifier anyway
         await this.generateUserKey(userId, newIdentifier, "password");
         return; // Exit early as re-encryption isn't possible
       }

       // Generate the new key *before* potentially failing decryption
       const newKey = await this.generateUserKey(userId, newIdentifier, "password");

       // --- Re-encryption Logic ---
       // This needs access to StorageService methods (getActiveSessions, loadChatHistory, saveChatHistory, saveSession)
       // Since StorageService causes a cycle, this logic might need to be moved
       // to a higher-level service or StorageService needs refactoring.
       console.warn("Re-encryption logic during password change needs implementation outside EncryptionService or refactoring to avoid circular dependency with StorageService.");
       // --- Placeholder for re-encryption ---
       // const sessions = await StorageService.getActiveSessionsForUser(userId); // Needs this method
       // for (const session of sessions) {
       //   const messages = await StorageService.loadChatHistory(session.id);
       //   const reEncrypted = await Promise.all(messages.map(async msg => {
       //      const decrypted = await this.decryptChatMessageWithKey(msg, userId, oldKey); // Decrypt with OLD key
       //      return await this.encryptChatMessageWithKey(decrypted, userId, newKey); // Encrypt with NEW key
       //   }));
       //   await StorageService.saveChatHistory(session.id, reEncrypted, false);
       //   await StorageService.saveSessionMetadata({ ...session, messages: [] }); // Update metadata timestamp?
       // }
       // --- End Placeholder ---

       console.log(`EncryptionService: Password change processed for user ${userId}. New key generated. Re-encryption needed separate implementation.`);
     } catch (error) {
       console.error("Error handling password change:", error);
       throw error;
     }
   }

   /**
    * Handles migrating encryption from an old key to a new key (e.g., algorithm change).
    * Requires the old key and StorageService access.
    * @param userId User ID.
    * @param oldKey The previous encryption key.
    * @param newIdentifier Identifier for generating the new key (optional, uses current if not provided).
    * @throws If any step fails.
    */
   static async migrateEncryption(userId: string, oldKey: string, newIdentifier?: string): Promise<void> {
        console.log(`EncryptionService: Starting encryption migration for user ${userId}`);
        try {
            const identifier = newIdentifier || await this.getUserIdentifier(userId); // Need helper to get current identifier
            if (!identifier) throw new Error("Cannot determine identifier for new key generation.");

            const authType = await AsyncStorage.getItem(`${this.AUTH_TYPE_KEY}${userId}`) as "password" | "social" || "password";
            const newKey = await this.generateUserKey(userId, identifier, authType);

            // --- Migration Logic ---
            console.warn("Encryption migration logic needs implementation outside EncryptionService or refactoring to avoid circular dependency with StorageService.");
            // --- Placeholder for migration ---
            // const sessions = await StorageService.getActiveSessionsForUser(userId);
            // for (const session of sessions) {
            //    // ... similar re-encryption logic as handlePasswordChange ...
            // }
            // --- End Placeholder ---

            console.log(`EncryptionService: Migration processed for user ${userId}. New key generated. Re-encryption needed separate implementation.`);
        } catch (error) {
            console.error("Error migrating encryption:", error);
            throw error;
        }
    }

    // Helper needed for migration if newIdentifier isn't provided
    private static async getUserIdentifier(userId: string): Promise<string | null> {
        // This logic depends on how identifiers are stored or retrieved (e.g., email from profile)
        console.warn("getUserIdentifier logic needs implementation.");
        const { data: { user } } = await supabase.auth.getUser();
        return user?.email ?? null; // Example: use email
    }

} // End of EncryptionService class
