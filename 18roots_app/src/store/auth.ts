import { create } from "zustand";

import type { Session, Tokens, User } from "@/api/schemas";
import { secureStorage } from "@/lib/storage";

const KEYS = {
  access: "roots18.accessToken",
  refresh: "roots18.refreshToken",
  expires: "roots18.expiresAt",
  user: "roots18.user",
} as const;

type AuthStatus = "loading" | "signedOut" | "signedIn";

type AuthState = {
  status: AuthStatus;
  tokens: Tokens | null;
  user: User | null;
  hydrate: () => Promise<void>;
  signIn: (session: Session) => Promise<void>;
  setTokens: (tokens: Tokens) => Promise<void>;
  setUser: (user: User) => Promise<void>;
  signOut: () => Promise<void>;
};

async function writeTokens(tokens: Tokens) {
  await Promise.all([
    secureStorage.setItem(KEYS.access, tokens.accessToken),
    secureStorage.setItem(KEYS.refresh, tokens.refreshToken),
    secureStorage.setItem(KEYS.expires, tokens.expiresAt),
  ]);
}

export const useAuth = create<AuthState>()((set) => ({
  status: "loading",
  tokens: null,
  user: null,

  hydrate: async () => {
    try {
      const [accessToken, refreshToken, expiresAt, userJson] = await Promise.all([
        secureStorage.getItem(KEYS.access),
        secureStorage.getItem(KEYS.refresh),
        secureStorage.getItem(KEYS.expires),
        secureStorage.getItem(KEYS.user),
      ]);
      if (accessToken && refreshToken && expiresAt && userJson) {
        set({ status: "signedIn", tokens: { accessToken, refreshToken, expiresAt }, user: JSON.parse(userJson) });
        return;
      }
    } catch {
      // A corrupt or unreadable keychain entry means signing in again.
    }
    set({ status: "signedOut", tokens: null, user: null });
  },

  signIn: async (session) => {
    const { user, ...tokens } = session;
    await Promise.all([writeTokens(tokens), secureStorage.setItem(KEYS.user, JSON.stringify(user))]);
    set({ status: "signedIn", tokens, user });
  },

  setTokens: async (tokens) => {
    await writeTokens(tokens);
    set({ tokens });
  },

  setUser: async (user) => {
    await secureStorage.setItem(KEYS.user, JSON.stringify(user));
    set({ user });
  },

  signOut: async () => {
    await Promise.all(Object.values(KEYS).map((key) => secureStorage.removeItem(key)));
    set({ status: "signedOut", tokens: null, user: null });
  },
}));
