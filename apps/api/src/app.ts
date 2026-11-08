import Fastify, { type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import { openDatabase, StudentStore, type StudentRecord } from './db.ts';

const studentSchema = {
  type: 'object',
  required: ['id', 'fullName', 'group', 'averageScore', 'updatedAt'],
  properties: {
    id: { type: 'string', minLength: 1 },
    fullName: { type: 'string', minLength: 1 },
    group: { type: 'string' },
    averageScore: { type: 'number', minimum: 0, maximum: 5 },
    documentNumber: { type: 'string', default: '' },
    updatedAt: { type: 'integer' },
    deleted: { type: 'boolean', default: false },
  },
} as const;

/** Builds the Fastify app. Kept separate from `server.ts` so tests can use `app.inject()`. */
export function buildApp(opts: FastifyServerOptions & { dbPath?: string } = {}) {
  const { dbPath, ...fastifyOpts } = opts;
  const app = Fastify(fastifyOpts);
  const store = new StudentStore(openDatabase(dbPath));

  app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok', time: Date.now() }));

  // Pull: everything changed after `since` (including tombstones, so clients can apply deletes).
  app.get<{ Querystring: { since?: number } }>(
    '/students',
    { schema: { querystring: { type: 'object', properties: { since: { type: 'integer', default: 0 } } } } },
    async (req) => store.list(req.query.since ?? 0),
  );

  app.get<{ Params: { id: string } }>('/students/:id', async (req, reply) => {
    const s = store.get(req.params.id);
    if (!s || s.deleted) return reply.code(404).send({ message: 'Student not found' });
    return s;
  });

  // Push: create or update (idempotent PUT keyed by client-generated UUID).
  app.put<{ Params: { id: string }; Body: StudentRecord }>(
    '/students/:id',
    { schema: { body: studentSchema } },
    async (req, reply) => {
      if (req.body.id !== req.params.id) return reply.code(400).send({ message: 'id mismatch' });
      const { record, applied } = store.upsert(req.body);
      if (!applied) req.log.warn({ id: record.id }, 'stale write rejected (last-write-wins)');
      return reply.code(applied ? 200 : 409).send(record);
    },
  );

  // Soft delete (tombstone) so other devices learn about the deletion on pull.
  app.delete<{ Params: { id: string }; Querystring: { updatedAt?: number } }>(
    '/students/:id',
    async (req, reply) => {
      const existing = store.get(req.params.id);
      if (!existing) return reply.code(204).send();
      const updatedAt = Number(req.query.updatedAt ?? Date.now());
      const { applied, record } = store.upsert({ ...existing, deleted: true, updatedAt });
      return applied ? reply.code(204).send() : reply.code(409).send(record);
    },
  );

  return app;
}
