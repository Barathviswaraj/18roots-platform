// Web is only used to preview screens during development. Browsers have no
// secure enclave, so this falls back to localStorage.
export const secureStorage = {
  getItem: async (key: string) => {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  setItem: async (key: string, value: string) => {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Private browsing can block storage; the session then lasts until reload.
    }
  },
  removeItem: async (key: string) => {
    try {
      globalThis.localStorage?.removeItem(key);
    } catch {
      // Nothing stored, nothing to remove.
    }
  },
};
