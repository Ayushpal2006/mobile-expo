/**
 * Orion POS Mobile Expo - Storage Service
 *
 * Persists auth token and session payload securely using expo-secure-store
 * with fallback in-memory cache for web/dev mock environments.
 */

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'orion_pos_auth_token';
const CONTEXT_KEY = 'orion_pos_session_context';

// Fallback in-memory store for web or unsupported environments
let memoryTokenFallback: string | null = null;
let memoryContextFallback: string | null = null;

const isSecureStoreAvailable = (): boolean => {
  return Platform.OS === 'android' || Platform.OS === 'ios';
};

export const StorageService = {
  /**
   * Securely saves authentication token and serialized session context
   */
  async saveAuthToken(token: string, sessionContextJson?: string): Promise<boolean> {
    if (!isSecureStoreAvailable()) {
      memoryTokenFallback = token;
      memoryContextFallback = sessionContextJson || null;
      return true;
    }

    try {
      await SecureStore.setItemAsync(TOKEN_KEY, token);
      if (sessionContextJson) {
        await SecureStore.setItemAsync(CONTEXT_KEY, sessionContextJson);
      }
      return true;
    } catch (error) {
      console.warn('[StorageService] Error saving to SecureStore, using memory fallback:', error);
      memoryTokenFallback = token;
      memoryContextFallback = sessionContextJson || null;
      return true;
    }
  },

  /**
   * Retrieves secure authentication token and session context
   */
  async getAuthToken(): Promise<{ token: string; contextJson: string | null } | null> {
    if (!isSecureStoreAvailable()) {
      if (memoryTokenFallback) {
        return {
          token: memoryTokenFallback,
          contextJson: memoryContextFallback,
        };
      }
      return null;
    }

    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const contextJson = await SecureStore.getItemAsync(CONTEXT_KEY);

      if (token) {
        return { token, contextJson };
      }
      return null;
    } catch (error) {
      console.warn('[StorageService] Error reading SecureStore, using memory fallback:', error);
      if (memoryTokenFallback) {
        return {
          token: memoryTokenFallback,
          contextJson: memoryContextFallback,
        };
      }
      return null;
    }
  },

  /**
   * Clears authentication token and session context on logout
   */
  async clearAuthToken(): Promise<boolean> {
    memoryTokenFallback = null;
    memoryContextFallback = null;

    if (!isSecureStoreAvailable()) {
      return true;
    }

    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(CONTEXT_KEY);
      return true;
    } catch {
      return true;
    }
  },
};

export default StorageService;
