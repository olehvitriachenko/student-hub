import { randomUUID } from 'node:crypto';
import Fastify, { type FastifyReply, type FastifyRequest, type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import {
  AssignmentStore,
  ChatStore,
  openDatabase,
  toPublicUser,
  UserStore,
  type AssignmentRecord,
  type UserRecord,
} from './db.ts';
import {
  hashPassword,
  hashToken,
  newSessionToken,
  newStudentCard,
  SESSION_TTL_MS,
  validateRegister,
  verifyAgainstDummy,
  verifyPassword,
} from './auth.ts';
import { scheduleFor, starterAssignments } from './schedule.ts';
import { registerChat } from './chat.ts';

declare module 'fastify' {
  interface FastifyRequest {
    user: UserRecord | null;
    tokenHash: string | null;
  }
}

const assignmentSchema = {
  type: 'object',
  required: ['id', 'title', 'subject', 'dueAt', 'updatedAt'],
  properties: {
    id: { type: 'string', minLength: 1, maxLength: 64 },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    subject: { type: 'string', minLength: 1, maxLength: 100 },
    description: { type: 'string', maxLength: 5000, default: '' },
    dueAt: { type: 'integer' },
    done: { type: 'boolean', default: false },
    grade: { type: ['number', 'null'], minimum: 0, maximum: 100, default: null },
    updatedAt: { type: 'integer' },
    deleted: { type: 'boolean', default: false },
  },
} as const;

/** Будує Fastify-застосунок. Окремо від `server.ts`, щоб тести могли використовувати `app.inject()`. */
export function buildApp(opts: FastifyServerOptions & { dbPath?: string } = {}) {
  const { dbPath, ...fastifyOpts } = opts;
  const app = Fastify(fastifyOpts);
  const db = openDatabase(dbPath);
  const users = new UserStore(db);
  const assignments = new AssignmentStore(db);
  const chat = new ChatStore(db);

  app.register(cors, { origin: true });
  app.register(websocket);
  app.decorateRequest('user', null);
  app.decorateRequest('tokenHash', null);

  /** preHandler для захищених маршрутів: `Authorization: Bearer <token>`. */
  async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const tokenHash = token ? hashToken(token) : '';
    const user = tokenHash ? users.bySession(tokenHash) : undefined;
    if (!user) return reply.code(401).send({ message: 'Сесія закінчилась, увійдіть знову' });
    req.user = user;
    req.tokenHash = tokenHash;
  }

  const issueSession = (user: UserRecord) => {
    const { token, tokenHash } = newSessionToken();
    users.createSession(tokenHash, user.id, SESSION_TTL_MS);
    return { token, user: toPublicUser(user) };
  };

  app.get('/health', async () => ({ status: 'ok', time: Date.now() }));

  // ---------------- Auth ----------------

  app.post<{ Body: Record<string, unknown> }>('/auth/register', async (req, reply) => {
    const input = validateRegister(req.body ?? {});
    if (typeof input === 'string') return reply.code(400).send({ message: input });
    if (users.byEmail(input.email)) return reply.code(409).send({ message: 'Акаунт з таким email уже існує' });

    const user: UserRecord = {
      id: randomUUID(),
      email: input.email,
      passwordHash: await hashPassword(input.password),
      fullName: input.fullName,
      group: input.group,
      studentCard: newStudentCard(),
      createdAt: Date.now(),
    };
    users.insert(user);
    const now = Date.now();
    for (const a of starterAssignments(now)) {
      assignments.upsert(user.id, { id: randomUUID(), ...a, updatedAt: now, deleted: false });
    }
    req.log.info({ userId: user.id }, 'user registered');
    return reply.code(201).send(issueSession(user));
  });

  // Крок 1 реєстрації: чи вільний email (щоб не дізнаватись про це лише на останньому кроці).
  app.post<{ Body: { email?: unknown } }>('/auth/check-email', async (req, reply) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply.code(400).send({ message: 'Некоректний email' });
    return { available: !users.byEmail(email) };
  });

  app.post<{ Body: { email?: unknown; password?: unknown } }>('/auth/login', async (req, reply) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const user = users.byEmail(email);
    const ok = user ? await verifyPassword(user.passwordHash, password) : await verifyAgainstDummy(password);
    if (!user || !ok) return reply.code(401).send({ message: 'Невірний email або пароль' });
    return issueSession(user);
  });

  app.post('/auth/logout', { preHandler: requireAuth }, async (req, reply) => {
    users.deleteSession(req.tokenHash!);
    return reply.code(204).send();
  });

  app.get('/me', { preHandler: requireAuth }, async (req) => toPublicUser(req.user!));

  app.patch<{ Body: { fullName?: unknown; group?: unknown } }>('/me', { preHandler: requireAuth }, async (req, reply) => {
    const fullName = typeof req.body?.fullName === 'string' ? req.body.fullName.trim().replace(/\s+/g, ' ') : req.user!.fullName;
    const group = typeof req.body?.group === 'string' ? req.body.group.trim().toUpperCase() : req.user!.group;
    if (fullName.split(' ').length < 2) return reply.code(400).send({ message: 'Вкажіть прізвище та ім’я' });
    if (!group) return reply.code(400).send({ message: 'Вкажіть академічну групу' });
    users.updateProfile(req.user!.id, { fullName, group });
    return toPublicUser(users.byId(req.user!.id)!);
  });

  // ---------------- Schedule ----------------

  app.get('/schedule', { preHandler: requireAuth }, async (req) => ({
    group: req.user!.group,
    lessons: scheduleFor(req.user!.group),
  }));

  // ---------------- Assignments (offline sync, лаб. 4) ----------------

  app.get<{ Querystring: { since?: number } }>(
    '/assignments',
    {
      preHandler: requireAuth,
      schema: { querystring: { type: 'object', properties: { since: { type: 'integer', default: 0 } } } },
    },
    async (req) => assignments.list(req.user!.id, req.query.since ?? 0),
  );

  app.put<{ Params: { id: string }; Body: AssignmentRecord }>(
    '/assignments/:id',
    { preHandler: requireAuth, schema: { body: assignmentSchema } },
    async (req, reply) => {
      if (req.body.id !== req.params.id) return reply.code(400).send({ message: 'id mismatch' });
      const result = assignments.upsert(req.user!.id, req.body);
      if (result === 'forbidden') return reply.code(404).send({ message: 'Not found' });
      if (!result.applied) req.log.warn({ id: req.body.id }, 'stale write rejected (last-write-wins)');
      return reply.code(result.applied ? 200 : 409).send(result.record);
    },
  );

  // Soft delete (tombstone), щоб інші пристрої дізнались про видалення під час pull.
  app.delete<{ Params: { id: string }; Querystring: { updatedAt?: number } }>(
    '/assignments/:id',
    { preHandler: requireAuth },
    async (req, reply) => {
      const existing = assignments.get(req.user!.id, req.params.id);
      if (existing === 'forbidden') return reply.code(404).send({ message: 'Not found' });
      if (!existing) return reply.code(204).send();
      const updatedAt = Number(req.query.updatedAt ?? Date.now());
      const result = assignments.upsert(req.user!.id, { ...existing, deleted: true, updatedAt });
      if (result === 'forbidden') return reply.code(404).send();
      return result.applied ? reply.code(204).send() : reply.code(409).send(result.record);
    },
  );

  // ---------------- Chat (WebSocket) ----------------

  app.get<{ Querystring: { before?: number } }>(
    '/chat/messages',
    { preHandler: requireAuth, schema: { querystring: { type: 'object', properties: { before: { type: 'integer' } } } } },
    async (req) => ({ room: req.user!.group, messages: chat.history(req.user!.group, req.query.before) }),
  );

  app.register(async (scope) => registerChat(scope, users, chat));

  return app;
}
