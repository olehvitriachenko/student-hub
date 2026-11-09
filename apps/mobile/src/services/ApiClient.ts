import Constants from 'expo-constants';
import type { Assignment } from '../models/Assignment';
import type { ChatMessage } from '../models/ChatMessage';
import type { Schedule } from '../models/Lesson';
import type { AuthResponse, User } from '../models/User';

/**
 * REST-клієнт до Fastify API (apps/api).
 *
 * Адреса береться з EXPO_PUBLIC_API_URL, інакше — з IP машини, на якій запущено
 * Metro (так телефон з Expo Go у тій самій Wi-Fi мережі бачить API).
 */
function resolveBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL;
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:3000`;
}

/** AbortSignal.timeout є не в усіх рушіях JS, тому — власна реалізація. */
function timeoutSignal(ms: number): AbortSignal {
  const c = new AbortController();
  setTimeout(() => c.abort(), ms);
  return c.signal;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: unknown;

  constructor(status: number, body: unknown) {
    const msg = (body as { message?: unknown } | undefined)?.message;
    super(typeof msg === 'string' ? msg : `API responded with ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/** Повідомлення для користувача з будь-якої помилки запиту. */
export function userMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  return 'Немає з’єднання з сервером. Перевірте, що API запущено, і спробуйте ще раз.';
}

export class ApiClient {
  readonly baseUrl = resolveBaseUrl();
  private token: string | null = null;
  /** Викликається, коли сервер відповів 401 на запит із токеном (сесія закінчилась). */
  onUnauthorized: (() => void) | null = null;

  setToken(token: string | null) {
    this.token = token;
  }

  async health(timeoutMs = 3000): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: timeoutSignal(timeoutMs) });
      return res.ok;
    } catch {
      return false;
    }
  }

  // ---------- Auth ----------

  register(input: { email: string; password: string; fullName: string; group: string }) {
    return this.request<AuthResponse>('POST', '/auth/register', input);
  }

  checkEmail(email: string) {
    return this.request<{ available: boolean }>('POST', '/auth/check-email', { email });
  }

  login(email: string, password: string) {
    return this.request<AuthResponse>('POST', '/auth/login', { email, password });
  }

  logout() {
    return this.request<void>('POST', '/auth/logout');
  }

  me() {
    return this.request<User>('GET', '/me');
  }

  updateMe(fields: { fullName: string; group: string }) {
    return this.request<User>('PATCH', '/me', fields);
  }

  // ---------- Schedule ----------

  schedule() {
    return this.request<Schedule>('GET', '/schedule');
  }

  // ---------- Chat ----------

  chatHistory(before?: number) {
    return this.request<{ room: string; messages: ChatMessage[] }>('GET', `/chat/messages${before ? `?before=${before}` : ''}`);
  }

  /** ws://…/chat/ws?token=… (токен у query: заголовки для WebSocket у RN передавати незручно). */
  chatSocketUrl(): string | null {
    if (!this.token) return null;
    return `${this.baseUrl.replace(/^http/, 'ws')}/chat/ws?token=${encodeURIComponent(this.token)}`;
  }

  // ---------- Assignments (sync) ----------

  pullAssignments(since: number) {
    return this.request<Assignment[]>('GET', `/assignments?since=${since}`);
  }

  /** 200 — застосовано; 409 — на сервері новіша версія (повертається вона). */
  async upsertAssignment(a: Assignment): Promise<{ conflict: boolean; record: Assignment }> {
    try {
      return { conflict: false, record: await this.request<Assignment>('PUT', `/assignments/${a.id}`, a) };
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return { conflict: true, record: e.body as Assignment };
      throw e;
    }
  }

  async deleteAssignment(id: string, updatedAt: number): Promise<void> {
    try {
      await this.request('DELETE', `/assignments/${id}?updatedAt=${updatedAt}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return; // на сервері новіша версія — заберемо її при pull
      throw e;
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: timeoutSignal(10_000),
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : undefined;
    } catch {
      json = undefined;
    }
    if (res.status === 401 && this.token) this.onUnauthorized?.();
    if (!res.ok) throw new ApiError(res.status, json);
    return json as T;
  }
}
