import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const ENCRYPTION_OPTIONS = {
  keychainService: 'warthog-wallet',
  sharedPreferencesName: 'warthog-wallet',
  encrypt: true,
  requireAuthentication: false,
  accessGroup: undefined,
};

export const storage = {
  async setItemAsync(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.setItem(key, value);
    } else {
      await SecureStore.setItemAsync(key, value, ENCRYPTION_OPTIONS);
    }
  },

  async getItemAsync(key: string): Promise<string | null> {
    if (Platform.OS === 'web') {
      return localStorage.getItem(key);
    } else {
      return await SecureStore.getItemAsync(key, ENCRYPTION_OPTIONS);
    }
  },

  async deleteItemAsync(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      localStorage.removeItem(key);
    } else {
      await SecureStore.deleteItemAsync(key, ENCRYPTION_OPTIONS);
    }
  }
};
