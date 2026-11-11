import * as SecureStore from "expo-secure-store";

// Keychain on iOS and Keystore-backed storage on Android. Values must stay
// small (about 2 KB), so tokens are stored under separate keys.
export const secureStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK }),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};
