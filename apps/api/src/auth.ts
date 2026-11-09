import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';

/**
 * Паролі хешуються Argon2id (параметри за замовчуванням @node-rs/argon2 відповідають
 * рекомендаціям OWASP: m=19 MiB, t=2, p=1). Сам пароль ніде не зберігається.
 */
export const hashPassword = (password: string) => hash(password);

export const verifyPassword = (passwordHash: string, password: string) => verify(passwordHash, password);

/**
 * Хеш-заглушка: якщо користувача з таким email немає, все одно виконуємо verify,
 * щоб час відповіді не видавав, чи існує акаунт (захист від перебору email).
 */
let dummyHash: Promise<string> | null = null;
export async function verifyAgainstDummy(password: string): Promise<false> {
  dummyHash ??= hash('dummy-password-for-timing');
  await verify(await dummyHash, password);
  return false;
}

/**
 * Сесійний токен: 256 біт випадковості. Клієнт отримує сам токен,
 * у БД зберігається лише його SHA-256 — витік БД не дає готових токенів.
 */
export function newSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, tokenHash: hashToken(token) };
}

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Номер студентського квитка, наприклад «КВ 12345678». */
export const newStudentCard = () => `КВ ${String(randomBytes(4).readUInt32BE() % 100_000_000).padStart(8, '0')}`;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  group: string;
}

/** Валідація з повідомленнями українською — їх напряму показує мобільний застосунок. */
export function validateRegister(body: Partial<Record<keyof RegisterInput, unknown>>): RegisterInput | string {
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const input = {
    email: str(body.email).toLowerCase(),
    password: typeof body.password === 'string' ? body.password : '',
    fullName: str(body.fullName).replace(/\s+/g, ' '),
    group: str(body.group).toUpperCase(),
  };
  if (input.fullName.split(' ').length < 2) return 'Вкажіть прізвище та ім’я';
  if (!input.group) return 'Вкажіть академічну групу';
  if (!EMAIL_RE.test(input.email)) return 'Некоректний email';
  if (input.password.length < 8) return 'Пароль має містити щонайменше 8 символів';
  if (!/\d/.test(input.password) || !/\p{L}/u.test(input.password)) return 'Пароль має містити літери та цифри';
  return input;
}
