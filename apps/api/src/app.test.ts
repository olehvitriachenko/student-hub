import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from './app.ts';

const registration = {
  email: 'Olena@Example.com',
  password: 'secret123',
  fullName: 'Петренко Олена',
  group: 'кн-31',
};

test('register, login, profile and logout', async () => {
  const app = buildApp({ dbPath: ':memory:' });

  let res = await app.inject({ method: 'POST', url: '/auth/register', payload: { ...registration, password: 'short' } });
  assert.equal(res.statusCode, 400);

  res = await app.inject({ method: 'POST', url: '/auth/register', payload: registration });
  assert.equal(res.statusCode, 201);
  const { token, user } = res.json();
  assert.equal(user.email, 'olena@example.com');
  assert.equal(user.group, 'КН-31');
  assert.equal(user.passwordHash, undefined);

  res = await app.inject({ method: 'POST', url: '/auth/register', payload: registration });
  assert.equal(res.statusCode, 409);

  res = await app.inject({ method: 'POST', url: '/auth/check-email', payload: { email: 'OLENA@example.com' } });
  assert.equal(res.json().available, false);
  res = await app.inject({ method: 'POST', url: '/auth/check-email', payload: { email: 'new@example.com' } });
  assert.equal(res.json().available, true);

  res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: registration.email, password: 'wrong1234' } });
  assert.equal(res.statusCode, 401);

  res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'olena@example.com', password: 'secret123' } });
  assert.equal(res.statusCode, 200);

  const auth = { authorization: `Bearer ${token}` };
  res = await app.inject({ method: 'GET', url: '/me' });
  assert.equal(res.statusCode, 401);
  res = await app.inject({ method: 'PATCH', url: '/me', headers: auth, payload: { group: 'кн-32' } });
  assert.equal(res.json().group, 'КН-32');

  res = await app.inject({ method: 'GET', url: '/schedule', headers: auth });
  assert.ok(res.json().lessons.length >= 10);

  res = await app.inject({ method: 'POST', url: '/auth/logout', headers: auth });
  assert.equal(res.statusCode, 204);
  res = await app.inject({ method: 'GET', url: '/me', headers: auth });
  assert.equal(res.statusCode, 401);

  await app.close();
});

test('assignments: starter data, last-write-wins, soft delete, isolation between users', async () => {
  const app = buildApp({ dbPath: ':memory:' });
  const reg = async (email: string) =>
    (await app.inject({ method: 'POST', url: '/auth/register', payload: { ...registration, email } })).json().token as string;
  const a = { authorization: `Bearer ${await reg('a@x.ua')}` };
  const b = { authorization: `Bearer ${await reg('b@x.ua')}` };

  let res = await app.inject({ method: 'GET', url: '/assignments', headers: a });
  assert.equal(res.json().length, 5);

  const item = { id: 'task-1', title: 'Звіт', subject: 'Бази даних', dueAt: 5000, updatedAt: 1000 };
  res = await app.inject({ method: 'PUT', url: '/assignments/task-1', headers: a, payload: item });
  assert.equal(res.statusCode, 200);

  res = await app.inject({ method: 'PUT', url: '/assignments/task-1', headers: a, payload: { ...item, title: 'Old', updatedAt: 500 } });
  assert.equal(res.statusCode, 409);
  assert.equal(res.json().title, 'Звіт');

  // Інший користувач не бачить і не може змінити чуже завдання.
  res = await app.inject({ method: 'PUT', url: '/assignments/task-1', headers: b, payload: { ...item, updatedAt: 9999 } });
  assert.equal(res.statusCode, 404);

  res = await app.inject({ method: 'DELETE', url: '/assignments/task-1?updatedAt=2000', headers: a });
  assert.equal(res.statusCode, 204);
  res = await app.inject({ method: 'GET', url: '/assignments?since=1500', headers: a });
  assert.equal(res.json().find((x: { id: string }) => x.id === 'task-1').deleted, true);

  await app.close();
});

test('chat: websocket broadcast within a group and REST history', async () => {
  const app = buildApp({ dbPath: ':memory:' });
  await app.ready();
  const reg = async (email: string, fullName: string) =>
    (await app.inject({ method: 'POST', url: '/auth/register', payload: { ...registration, email, fullName } })).json().token as string;
  const t1 = await reg('a@x.ua', 'Петренко Олена');
  const t2 = await reg('b@x.ua', 'Іваненко Іван');

  const ws1 = await app.injectWS(`/chat/ws?token=${t1}`);
  const ws2 = await app.injectWS(`/chat/ws?token=${t2}`);
  const received = new Promise<{ type: string; message: { text: string; author: string } }>((resolve) => {
    ws2.on('message', (raw: Buffer) => {
      const msg = JSON.parse(String(raw));
      if (msg.type === 'message') resolve(msg);
    });
  });
  ws1.send(JSON.stringify({ type: 'message', text: 'Привіт, групо!' }));
  const msg = await received;
  assert.equal(msg.message.text, 'Привіт, групо!');
  assert.equal(msg.message.author, 'Петренко Олена');

  const res = await app.inject({ method: 'GET', url: '/chat/messages', headers: { authorization: `Bearer ${t2}` } });
  assert.equal(res.json().room, 'КН-31');
  assert.equal(res.json().messages.length, 1);

  // Реакція: розсилається всім у кімнаті й зберігається в історії; повторна — знімається.
  const messageId = res.json().messages[0].id as string;
  const reacted = new Promise<{ reactions: Record<string, string[]> }>((resolve) => {
    ws1.on('message', (raw: Buffer) => {
      const m = JSON.parse(String(raw));
      if (m.type === 'reactions') resolve(m);
    });
  });
  ws2.send(JSON.stringify({ type: 'react', messageId, emoji: '🔥' }));
  assert.equal((await reacted).reactions['🔥'].length, 1);
  const history = await app.inject({ method: 'GET', url: '/chat/messages', headers: { authorization: `Bearer ${t1}` } });
  assert.deepEqual(Object.keys(history.json().messages[0].reactions), ['🔥']);

  ws1.terminate();
  ws2.terminate();
  await app.close();
});
