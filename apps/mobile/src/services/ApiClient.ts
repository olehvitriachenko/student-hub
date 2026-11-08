import Constants from 'expo-constants';
import type { Student } from '../models/Student';

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
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`API responded with ${status}`);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  readonly baseUrl = resolveBaseUrl();

  async health(timeoutMs = 3000): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { signal: timeoutSignal(timeoutMs) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async pull(since: number): Promise<Student[]> {
    return this.request<Student[]>('GET', `/students?since=${since}`);
  }

  /** 200 — застосовано; 409 — на сервері новіша версія (повертається вона). */
  async upsert(s: Student): Promise<{ conflict: boolean; record: Student }> {
    try {
      return { conflict: false, record: await this.request<Student>('PUT', `/students/${s.id}`, s) };
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return { conflict: true, record: e.body as Student };
      throw e;
    }
  }

  async delete(id: string, updatedAt: number): Promise<void> {
    try {
      await this.request('DELETE', `/students/${id}?updatedAt=${updatedAt}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) return; // на сервері новіша версія — заберемо її при pull
      throw e;
    }
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: timeoutSignal(10_000),
    });
    const text = await res.text();
    const json = text ? JSON.parse(text) : undefined;
    if (!res.ok) throw new ApiError(res.status, json);
    return json as T;
  }
}
