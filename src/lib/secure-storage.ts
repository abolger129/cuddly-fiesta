import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// Keychain / Keystore on phones. Browsers have no secure store, so the web
// build (only used for trying things out) falls back to localStorage.
export async function getSecureItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

export async function setSecureItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') return localStorage.setItem(key, value);
  return SecureStore.setItemAsync(key, value);
}

export async function deleteSecureItem(key: string): Promise<void> {
  if (Platform.OS === 'web') return localStorage.removeItem(key);
  return SecureStore.deleteItemAsync(key);
}
