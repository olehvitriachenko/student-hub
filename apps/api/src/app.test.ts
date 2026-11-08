import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './app.ts';

const student = (over: Record<string, unknown> = {}) => ({
  id: 'a1',
  fullName: 'Іваненко Іван',
  group: 'ІПЗ-21',
  averageScore: 4.5,
  documentNumber: 'AB123456',
  updatedAt: 1000,
  deleted: false,
  ...over,
});

test('create, read, last-write-wins and soft delete', async () => {
  const app = buildApp({ dbPath: ':memory:' });

  let res = await app.inject({ method: 'PUT', url: '/students/a1', payload: student() });
  assert.equal(res.statusCode, 200);

  res = await app.inject({ method: 'GET', url: '/students/a1' });
  assert.equal(res.json().fullName, 'Іваненко Іван');

  // Older write is rejected with 409 and the current record.
  res = await app.inject({ method: 'PUT', url: '/students/a1', payload: student({ fullName: 'Old', updatedAt: 500 }) });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().fullName, 'Іваненко Іван');

  res = await app.inject({ method: 'DELETE', url: '/students/a1?updatedAt=2000' });
  assert.equal(res.statusCode, 204);

  res = await app.inject({ method: 'GET', url: '/students?since=1500' });
  assert.equal(res.json()[0].deleted, true);

  res = await app.inject({ method: 'PUT', url: '/students/a1', payload: student({ averageScore: 9 }) });
  assert.equal(res.statusCode, 400);

  await app.close();
});
