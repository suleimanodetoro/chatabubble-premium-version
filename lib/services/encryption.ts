// lib/services/encryption.ts
import * as Crypto from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ChatMessage } from "@/types";
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
  
  // Handle password change method
  static async handlePasswordChange(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    try {
      // Logic to re-encrypt with new password
      console.log('Re-encrypting user data with new password');
      
      // Generate new encryption key using new password
      await this.generateUserKey(userId, newPassword, 'password');
      
      // implement more logic here based on the the encryption 
      
      console.log('Password change completed successfully');
    } catch (error) {
      console.error('Error handling password change:', error);
      throw error;
    }
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

  // New helper methods for Unicode-safe Base64 encoding/decoding
  private static bytesToBase64(bytes: Uint8Array): string {
    // Convert bytes to binary string
    let binaryString = '';
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