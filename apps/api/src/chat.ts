import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { ChatStore, type ChatMessage, type UserRecord, type UserStore } from './db.ts';
import { hashToken } from './auth.ts';

/**
 * Простий чат групи через WebSocket.
 *
 * Підключення: `GET /chat/ws?token=<session token>` (заголовки в WebSocket із RN передавати незручно,
 * тому токен — у query). Кімната = академічна група користувача.
 *
 * Клієнт → сервер:  { type: 'message', text } | { type: 'typing' } | { type: 'react', messageId, emoji }
 * Сервер → клієнт:  { type: 'message', message } | { type: 'typing', userId, author } | { type: 'presence', online }
 *                   | { type: 'reactions', messageId, reactions }
 *
 * Історія — REST: `GET /chat/messages?before=<ms>` (останні 50).
 */
const MAX_LEN = 1000;
const EMOJI = new Set(['👍', '❤️', '😂', '🔥', '😮', '🎉']);

interface Client {
  ws: WebSocket;
  user: UserRecord;
}

export function registerChat(app: FastifyInstance, users: UserStore, chat: ChatStore) {
  const rooms = new Map<string, Set<Client>>();

  const broadcast = (room: string, payload: unknown, except?: Client) => {
    const data = JSON.stringify(payload);
    for (const c of rooms.get(room) ?? []) {
      if (c !== except && c.ws.readyState === c.ws.OPEN) c.ws.send(data);
    }
  };
  const presence = (room: string) => broadcast(room, { type: 'presence', online: rooms.get(room)?.size ?? 0 });

  app.get<{ Querystring: { token?: string } }>('/chat/ws', { websocket: true }, (socket, req) => {
    const token = req.query.token ?? '';
    const user = token ? users.bySession(hashToken(token)) : undefined;
    if (!user) {
      socket.close(4001, 'unauthorized');
      return;
    }
    const room = user.group;
    const client: Client = { ws: socket, user };
    if (!rooms.has(room)) rooms.set(room, new Set());
    rooms.get(room)!.add(client);
    presence(room);

    socket.on('message', (raw) => {
      let msg: { type?: unknown; text?: unknown; messageId?: unknown; emoji?: unknown };
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.type === 'typing') {
        broadcast(room, { type: 'typing', userId: user.id, author: user.fullName }, client);
        return;
      }
      if (msg.type === 'react' && typeof msg.messageId === 'string' && typeof msg.emoji === 'string' && EMOJI.has(msg.emoji)) {
        if (chat.room(msg.messageId) !== room) return; // реагувати можна лише в своїй кімнаті
        const reactions = chat.toggleReaction(msg.messageId, user.id, msg.emoji);
        broadcast(room, { type: 'reactions', messageId: msg.messageId, reactions });
        return;
      }
      if (msg.type === 'message' && typeof msg.text === 'string') {
        const text = msg.text.trim().slice(0, MAX_LEN);
        if (!text) return;
        const message: ChatMessage = { id: randomUUID(), room, userId: user.id, author: user.fullName, text, createdAt: Date.now() };
        chat.insert(message);
        message.reactions = {};
        broadcast(room, { type: 'message', message });
      }
    });

    socket.on('close', () => {
      rooms.get(room)?.delete(client);
      presence(room);
    });
  });
}
