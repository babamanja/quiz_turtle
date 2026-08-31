import { refreshSession } from "./refreshSessionApi";
import { clearStoredSession, getStoredAuthToken, setStoredSession } from "../userStorage";

const API_BASE = import.meta.env.VITE_API_BASE ?? "";

export class ApiError extends Error {
  status?: number;
  data?: unknown;

  constructor(message: string, status?: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  retry?: boolean;
};

function buildUrl(path: string, params?: RequestOptions["params"]): string {
  const qs = new URLSearchParams();
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        qs.set(key, String(value));
      }
    }
  }
  const query = qs.toString();
  return `${API_BASE}/api${path}${query ? `?${query}` : ""}`;
}

async function parseError(response: Response): Promise<ApiError> {
  const data = await response.json().catch(() => null);
  const message =
    data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string"
      ? (data as { error: string }).error
      : `HTTP ${response.status}`;
  return new ApiError(message, response.status, data);
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = getStoredAuthToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(buildUrl(path, options.params), {
    method: options.method ?? "GET",
    credentials: "include",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const skipRefresh =
    path.includes("/auth/login") || path.includes("/auth/signup") || path.includes("/auth/password");

  if (response.status === 401 && options.retry !== false && !skipRefresh && token) {
    try {
      const session = await refreshSession();
      setStoredSession({ user: session.user, token: session.token });
      return request<T>(path, { ...options, retry: false });
    } catch {
      clearStoredSession();
    }
  }

  if (!response.ok) {
    throw await parseError(response);
  }
  if (response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const apiClient = {
  get: async <T>(path: string, config?: { params?: RequestOptions["params"] }) => ({
    data: await request<T>(path, { method: "GET", params: config?.params }),
  }),
  post: async <T>(path: string, body?: unknown) => ({
    data: await request<T>(path, { method: "POST", body }),
  }),
  patch: async <T>(path: string, body?: unknown) => ({
    data: await request<T>(path, { method: "PATCH", body }),
  }),
  put: async <T>(path: string, body?: unknown) => ({
    data: await request<T>(path, { method: "PUT", body }),
  }),
  delete: async <T>(path: string, body?: unknown) => ({
    data: await request<T>(path, { method: "DELETE", body }),
  }),
};

export default apiClient;
