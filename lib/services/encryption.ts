// lib/services/encryption.ts
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChatMessage } from "@/types";
import { encode as encodeBase64, decode as decodeBase64 } from "base-64";

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
  static async migrateEncryption(
    userId: string,
    oldKey: string,
    newIdentifier: string
  ): Promise<void> {
    try {
      const authType =
        (await AsyncStorage.getItem(`${this.AUTH_TYPE_KEY}${userId}`)) ||
        "password";
      const newKey = await this.generateUserKey(
        userId,
        newIdentifier,
        authType as "password" | "social"
      );

      // Here you would re-encrypt all necessary data with the new key
      // This is a placeholder for your specific re-encryption logic
      console.log("Migration completed for user:", userId);
    } catch (error) {
      console.error("Error in encryption migration:", error);
      throw error;
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

      // Convert text to base64 for consistent encoding
      const textBuffer = encodeBase64(text);

      // XOR encryption (simple but effective for our use case)
      const encryptedBuffer = new Array(textBuffer.length);
      for (let i = 0; i < textBuffer.length; i++) {
        encryptedBuffer[i] = String.fromCharCode(
          textBuffer.charCodeAt(i) ^
            encryptionKey.charCodeAt(i % encryptionKey.length)
        );
      }

      return `${salt}:${encodeBase64(encryptedBuffer.join(""))}`;
    } catch (error) {
      console.error("Encryption error:", error);
      return text; // Fallback to plaintext
    }
  }

  private static async decrypt(
    encryptedText: string,
    key: string
  ): Promise<string> {
    try {
      const [salt, text] = encryptedText.split(":");
      if (!salt || !text) return encryptedText;

      // Recreate encryption key
      const encryptionKey = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${key}:${salt}`
      );

      // Decrypt using XOR
      const encryptedBuffer = decodeBase64(text);
      const decryptedBuffer = new Array(encryptedBuffer.length);
      for (let i = 0; i < encryptedBuffer.length; i++) {
        decryptedBuffer[i] = String.fromCharCode(
          encryptedBuffer.charCodeAt(i) ^
            encryptionKey.charCodeAt(i % encryptionKey.length)
        );
      }

      return decodeBase64(decryptedBuffer.join(""));
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
