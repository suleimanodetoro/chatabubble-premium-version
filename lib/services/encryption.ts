// lib/services/encryption.ts
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChatMessage } from "@/types";
import { StorageService } from "./storage";

// Remove the base-64 import as we'll implement our own Unicode-safe methods

export class EncryptionService {
  private static readonly KEY_PREFIX = "@encryption_key_";
  private static readonly AUTH_TYPE_KEY = "@auth_type_";

  static async generateUserKey(
    userId: string,
    identifier: string,
    authType: "password" | "social" = "password"
  ): Promise<string> {
    try {
      // Store auth type for future reference
      await AsyncStorage.setItem(`${this.AUTH_TYPE_KEY}${userId}`, authType);

      // For social auth, use a different key generation strategy
      const data =
        authType === "social"
          ? `${userId}:${identifier}:${await this.generateSocialSecret(userId)}`
          : `${userId}:${identifier}`;

      const key = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        data
      );
      await AsyncStorage.setItem(this.KEY_PREFIX + userId, key);
      return key;
    } catch (error) {
      console.error("Error generating key:", error);
      throw error;
    }
  }

  private static async generateSocialSecret(userId: string): Promise<string> {
    // Generate a persistent secret for social auth users
    const existingSecret = await AsyncStorage.getItem(
      `@social_secret:${userId}`
    );
    if (existingSecret) return existingSecret;

    const newSecret = await Crypto.getRandomBytesAsync(32);
    const secretString = Array.from(newSecret)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    await AsyncStorage.setItem(`@social_secret:${userId}`, secretString);
    return secretString;
  }

  // Enhanced password change handling in encryption.ts

  static async handlePasswordChange(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      console.log("Re-encrypting user data with new password");

      // Get old encryption key
      const oldKey = await this.getEncryptionKey(userId);
      if (!oldKey) {
        throw new Error("Old encryption key not found");
      }

      // Get user's chat sessions that need re-encryption
      const sessions = await StorageService.getActiveSessions();
      const userSessions = sessions.filter((s) => s.userId === userId);

      // Generate new encryption key using new password
      await this.generateUserKey(userId, newPassword, "password");
      const newKey = await this.getEncryptionKey(userId);

      if (!newKey) {
        throw new Error("New encryption key generation failed");
      }

      // Re-encrypt each session's messages
      for (const session of userSessions) {
        // Get original messages
        const messages = await StorageService.loadChatHistory(session.id);

        // Decrypt messages with old key and re-encrypt with new key
        const reEncryptedMessages = await Promise.all(
          messages.map(async (msg) => {
            try {
              // First, decrypt the message contents using the old key
              const decryptedOriginal = await this.decrypt(
                msg.content.original,
                oldKey
              );
              const decryptedTranslated = await this.decrypt(
                msg.content.translated,
                oldKey
              );

              // Then, re-encrypt with the new key
              const encryptedOriginal = await this.encrypt(
                decryptedOriginal,
                newKey
              );
              const encryptedTranslated = await this.encrypt(
                decryptedTranslated,
                newKey
              );

              return {
                ...msg,
                content: {
                  original: encryptedOriginal,
                  translated: encryptedTranslated,
                },
              };
            } catch (error) {
              console.error("Error re-encrypting message:", error);
              // If re-encryption fails, return the original message
              return msg;
            }
          })
        );

        // Save re-encrypted messages
        await StorageService.saveChatHistory(session.id, reEncryptedMessages);

        // Update session
        const updatedSession = {
          ...session,
          messages: reEncryptedMessages,
          lastUpdated: Date.now(),
        };
        await StorageService.saveSession(updatedSession);
      }

      console.log("Password change completed successfully");
    } catch (error) {
      console.error("Error handling password change:", error);
      throw error;
    }
  }

  static async migrateEncryption(
    userId: string,
    oldKey: string,
    newIdentifier: string
  ): Promise<void> {
    try {
      console.log("Starting encryption migration for user:", userId);

      // Get the authentication type
      const authType =
        (await AsyncStorage.getItem(`${this.AUTH_TYPE_KEY}${userId}`)) ||
        "password";

      // Generate new encryption key with the new identifier
      const newKey = await this.generateUserKey(
        userId,
        newIdentifier,
        authType as "password" | "social"
      );

      // Get user's chat sessions that need migration
      const sessions = await StorageService.getActiveSessions();
      const userSessions = sessions.filter((s) => s.userId === userId);
      console.log(`Found ${userSessions.length} sessions to migrate`);

      // Migrate each session
      for (const session of userSessions) {
        console.log(`Migrating session: ${session.id}`);

        // Get original messages
        const messages = await StorageService.loadChatHistory(session.id);

        // Decrypt messages with old key and re-encrypt with new key
        const migratedMessages = await Promise.all(
          messages.map(async (msg) => {
            try {
              // Decrypt with old key
              const decryptedOriginal = await this.decrypt(
                msg.content.original,
                oldKey
              );
              const decryptedTranslated = await this.decrypt(
                msg.content.translated,
                oldKey
              );

              // Re-encrypt with new key
              const encryptedOriginal = await this.encrypt(
                decryptedOriginal,
                newKey
              );
              const encryptedTranslated = await this.encrypt(
                decryptedTranslated,
                newKey
              );

              return {
                ...msg,
                content: {
                  original: encryptedOriginal,
                  translated: encryptedTranslated,
                },
              };
            } catch (error) {
              console.error("Error migrating message:", error);
              // If migration fails, return original message
              return msg;
            }
          })
        );

        // Save migrated messages
        await StorageService.saveChatHistory(session.id, migratedMessages);

        // Update session
        const updatedSession = {
          ...session,
          messages: migratedMessages,
          lastUpdated: Date.now(),
        };
        await StorageService.saveSession(updatedSession);
      }

      console.log("Migration completed successfully for user:", userId);
    } catch (error) {
      console.error("Error in encryption migration:", error);
      throw error;
    }
  }
  /**
   * Decrypts a chat message using either a provided key or the user's stored key
   */
  static async decryptChatMessageWithKey(
    message: ChatMessage,
    userId: string,
    specificKey?: string
  ): Promise<ChatMessage> {
    const key = specificKey || (await this.getEncryptionKey(userId));
    if (!key) {
      console.log("No decryption key found for user:", userId);
      return message;
    }

    try {
      return {
        ...message,
        content: {
          original: await this.decrypt(message.content.original, key),
          translated: await this.decrypt(message.content.translated, key),
        },
      };
    } catch (error) {
      console.error("Error decrypting chat message:", error);
      return message;
    }
  }

  /**
   * Encrypts a chat message using either a provided key or the user's stored key
   */
  static async encryptChatMessageWithKey(
    message: ChatMessage,
    userId: string,
    specificKey?: string
  ): Promise<ChatMessage> {
    const key = specificKey || (await this.getEncryptionKey(userId));
    if (!key) {
      console.log("No encryption key found for user:", userId);
      return message;
    }

    try {
      return {
        ...message,
        content: {
          original: await this.encrypt(message.content.original, key),
          translated: await this.encrypt(message.content.translated, key),
        },
      };
    } catch (error) {
      console.error("Error encrypting chat message:", error);
      return message;
    }
  }

  static async getEncryptionKey(userId: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(this.KEY_PREFIX + userId);
    } catch (error) {
      console.error("Error getting key:", error);
      return null;
    }
  }

  static async removeEncryptionKey(userId: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.KEY_PREFIX + userId);
    } catch (error) {
      console.error("Error removing key:", error);
      throw error;
    }
  }

  // New helper methods for Unicode-safe Base64 encoding/decoding
  private static bytesToBase64(bytes: Uint8Array): string {
    // Convert bytes to binary string
    let binaryString = "";
    for (let i = 0; i < bytes.length; i++) {
      binaryString += String.fromCharCode(bytes[i]);
    }
    // Use built-in btoa for Base64 encoding
    return btoa(binaryString);
  }

  private static base64ToBytes(base64: string): Uint8Array {
    // Use built-in atob for Base64 decoding to binary string
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  // Updated encrypt method that properly handles Unicode
  private static async encrypt(text: string, key: string): Promise<string> {
    try {
      // Generate a unique identifier for each encryption
      const timestamp = Date.now().toString();
      const salt = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        timestamp
      );

      // Create encryption key from master key and salt
      const encryptionKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${key}:${salt}`
      );

      // Convert text to bytes using TextEncoder (handles Unicode correctly)
      const encoder = new TextEncoder();
      const textBytes = encoder.encode(text);

      // Convert encryption key to bytes as well
      const keyBytes = encoder.encode(encryptionKey);

      // Perform XOR encryption on bytes
      const encryptedBytes = new Uint8Array(textBytes.length);
      for (let i = 0; i < textBytes.length; i++) {
        encryptedBytes[i] = textBytes[i] ^ keyBytes[i % keyBytes.length];
      }

      // Convert encrypted bytes to Base64 string
      const base64Result = this.bytesToBase64(encryptedBytes);

      return `${salt}:${base64Result}`;
    } catch (error) {
      console.error("Encryption error:", error);
      return text; // Fallback to plaintext
    }
  }

  // Updated decrypt method that properly handles Unicode
  private static async decrypt(
    encryptedText: string,
    key: string
  ): Promise<string> {
    try {
      const [salt, base64Text] = encryptedText.split(":");
      if (!salt || !base64Text) return encryptedText;

      // Recreate encryption key
      const encryptionKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${key}:${salt}`
      );

      // Convert Base64 text to bytes
      const encryptedBytes = this.base64ToBytes(base64Text);

      // Convert encryption key to bytes
      const encoder = new TextEncoder();
      const keyBytes = encoder.encode(encryptionKey);

      // Perform XOR decryption on bytes
      const decryptedBytes = new Uint8Array(encryptedBytes.length);
      for (let i = 0; i < encryptedBytes.length; i++) {
        decryptedBytes[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
      }

      // Convert decrypted bytes back to text using TextDecoder
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBytes);
    } catch (error) {
      console.error("Decryption error:", error);
      return encryptedText;
    }
  }

  static async encryptChatMessage(
    message: ChatMessage,
    userId: string
  ): Promise<ChatMessage> {
    const key = await this.getEncryptionKey(userId);
    if (!key) {
      console.log("No encryption key found for user:", userId);
      return message;
    }

    try {
      return {
        ...message,
        content: {
          original: await this.encrypt(message.content.original, key),
          translated: await this.encrypt(message.content.translated, key),
        },
      };
    } catch (error) {
      console.error("Error encrypting chat message:", error);
      return message;
    }
  }

  static async decryptChatMessage(
    message: ChatMessage,
    userId: string
  ): Promise<ChatMessage> {
    const key = await this.getEncryptionKey(userId);
    if (!key) {
      console.log("No decryption key found for user:", userId);
      return message;
    }

    try {
      return {
        ...message,
        content: {
          original: await this.decrypt(message.content.original, key),
          translated: await this.decrypt(message.content.translated, key),
        },
      };
    } catch (error) {
      console.error("Error decrypting chat message:", error);
      return message;
    }
  }
}
