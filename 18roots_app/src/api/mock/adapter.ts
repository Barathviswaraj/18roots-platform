import { AxiosError, AxiosHeaders, type AxiosAdapter, type AxiosResponse } from "axios";

import { env } from "@/lib/env";
import { handleMockRequest } from "./server";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function splitUrl(url: string) {
  const withoutOrigin = url.replace(/^https?:\/\/[^/]+/, "");
  const [path, search = ""] = withoutOrigin.split("?");
  const query: Record<string, string> = {};
  for (const pair of search.split("&").filter(Boolean)) {
    const [key, value = ""] = pair.split("=");
    query[decodeURIComponent(key)] = decodeURIComponent(value.replace(/\+/g, " "));
  }
  return { path, query };
}

// Routes Axios requests to the in-memory backend with realistic latency.
// EXPO_PUBLIC_MOCK_FAILURE_RATE (0 to 1) makes some calls fail, to exercise
// retries and error screens.
export const mockAdapter: AxiosAdapter = async (config) => {
  await wait(250 + Math.random() * 300);

  const { path, query } = splitUrl(config.url ?? "/");
  const params: Record<string, string> = { ...query };
  for (const [key, value] of Object.entries(config.params ?? {})) {
    if (value !== undefined && value !== null && value !== "") params[key] = String(value);
  }
  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(AxiosHeaders.from(config.headers).toJSON())) {
    if (typeof value === "string") headers[key.toLowerCase()] = value;
  }
  const body = typeof config.data === "string" && config.data ? JSON.parse(config.data) : (config.data ?? {});
  const method = (config.method ?? "get").toUpperCase();

  if (method === "GET" && env.mockFailureRate > 0 && Math.random() < env.mockFailureRate) {
    throw new AxiosError("Network Error", AxiosError.ERR_NETWORK, config);
  }

  const result = handleMockRequest({ method, path, query: params, body, headers });
  const response: AxiosResponse = {
    data: result.body ?? "",
    status: result.status,
    statusText: String(result.status),
    headers: {},
    config,
    request: {},
  };
  if (result.status >= 400) {
    throw new AxiosError(
      `Request failed with status ${result.status}`,
      AxiosError.ERR_BAD_RESPONSE,
      config,
      {},
      response,
    );
  }
  return response;
};
