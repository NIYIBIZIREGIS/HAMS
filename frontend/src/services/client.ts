import axios, { AxiosError } from 'axios';
import { toast } from '../store/toastStore';

const API_URL = (import.meta.env.VITE_API_URL as string) ?? '/api';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiErrorBody {
  success: boolean;
  error?: string;
  details?: unknown;
}

export const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

let accessToken: string | null = localStorage.getItem('has_access_token');
let refreshToken: string | null = localStorage.getItem('has_refresh_token');

export function setTokens(tokens: AuthTokens) {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
  localStorage.setItem('has_access_token', tokens.accessToken);
  localStorage.setItem('has_refresh_token', tokens.refreshToken);
}

export function clearTokens() {
  accessToken = null;
  refreshToken = null;
  localStorage.removeItem('has_access_token');
  localStorage.removeItem('has_refresh_token');
}

export function getAccessToken() {
  return accessToken;
}

client.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  if (!refreshToken) throw new Error('No refresh token');
  const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
  const tokens = res.data.data.tokens as AuthTokens;
  setTokens(tokens);
  return tokens.accessToken;
}

client.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retry?: boolean }) | undefined;
    const isRefreshEndpoint = original?.url?.includes('/auth/refresh');
    // Signing in with bad credentials is a 401 too. Trying to refresh (and then hard-reloading
    // the page when there is no session) would wipe the form instead of showing the error.
    const isAuthAttempt = /\/auth\/(login|register|otp|forgot-password|reset-password)/.test(
      original?.url ?? '',
    );
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !isRefreshEndpoint &&
      !isAuthAttempt
    ) {
      original._retry = true;
      try {
        refreshPromise = refreshPromise ?? refreshAccessToken();
        const newToken = await refreshPromise;
        refreshPromise = null;
        original.headers.Authorization = `Bearer ${newToken}`;
        return client(original);
      } catch {
        refreshPromise = null;
        clearTokens();
        window.location.href = '/login';
      }
    }
    if (error.response) {
      const status = error.response.status;
      if (status >= 500) {
        toast.error('The server could not process your request. Please try again.', 'Something went wrong');
      }
    } else {
      toast.error('Unable to reach the server. Check your connection and try again.', 'Connection lost');
    }
    return Promise.reject(error);
  }
);

export function getErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiErrorBody | undefined;
    if (Array.isArray(data?.details) && data.details.length > 0) {
      const messages = data.details
        .map((d) => {
          const detail = d as { path?: string; message?: string };
          const message = detail.message?.trim();
          if (!message) return '';
          return detail.path ? `${detail.path}: ${message}` : message;
        })
        .filter(Boolean);
      if (messages.length) return messages.join(', ');
    }
    if (data?.error) return data.error;
  }
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}
