import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { z } from "zod";

import { env, isMock } from "@/lib/env";
import { useAuth } from "@/store/auth";
import { usePreferences } from "@/store/preferences";
import { mockAdapter } from "./mock/adapter";
import { tokensSchema } from "./schemas";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isNetwork() {
    return this.code === "network" || this.code === "timeout";
  }
}

export const api = axios.create({
  baseURL: isMock ? "https://mock.18roots.local" : env.apiUrl,
  timeout: 15_000,
  headers: { Accept: "application/json" },
  adapter: isMock ? mockAdapter : undefined,
});

api.interceptors.request.use((config) => {
  const token = useAuth.getState().tokens?.accessToken;
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  config.headers.set("Accept-Language", usePreferences.getState().language === "ta" ? "ta-IN" : "en-IN");
  return config;
});

// One refresh at a time: requests that fail together wait for the same refresh.
let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const refreshToken = useAuth.getState().tokens?.refreshToken;
  if (!refreshToken) return false;
  try {
    const response = await api.post("/v1/auth/refresh", { refreshToken }, { skipAuthRefresh: true });
    await useAuth.getState().setTokens(tokensSchema.parse(response.data));
    return true;
  } catch {
    return false;
  }
}

declare module "axios" {
  interface AxiosRequestConfig {
    skipAuthRefresh?: boolean;
    retriedAfterRefresh?: boolean;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as InternalAxiosRequestConfig | undefined;
    if (error.response?.status === 401 && config && !config.skipAuthRefresh && !config.retriedAfterRefresh) {
      refreshing ??= refreshTokens().finally(() => {
        refreshing = null;
      });
      if (await refreshing) {
        config.retriedAfterRefresh = true;
        return api.request(config);
      }
      await useAuth.getState().signOut();
    }
    throw toApiError(error);
  },
);

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof AxiosError) {
    if (error.code === AxiosError.ECONNABORTED || error.code === "ETIMEDOUT") {
      return new ApiError(0, "timeout", "The server took too long to answer");
    }
    if (!error.response) return new ApiError(0, "network", "No internet connection");
    const body = error.response.data as { error?: { code?: string; message?: string } } | undefined;
    return new ApiError(
      error.response.status,
      body?.error?.code ?? `http_${error.response.status}`,
      body?.error?.message ?? error.message,
    );
  }
  return new ApiError(0, "unknown", error instanceof Error ? error.message : "Unexpected error");
}

// Checks a response against its schema. A mismatch means the backend and the
// app disagree on the contract, which should be loud in development.
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    if (__DEV__) console.warn("Response did not match the schema", result.error.issues);
    throw new ApiError(0, "invalid_response", "The server sent an unexpected response");
  }
  return result.data;
}
