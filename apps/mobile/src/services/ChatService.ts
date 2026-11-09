import { ObservableObject } from '../core/mvvm/ObservableObject';
import { ObservableCollection } from '../core/mvvm/ObservableCollection';
import type { ILogger } from '../core/logging/Logger';
import type { ChatMessage, ChatServerEvent, ChatStatus } from '../models/ChatMessage';
import type { ApiClient } from './ApiClient';

const TYPING_TTL = 3000;
const MAX_BACKOFF = 15_000;

/**
 * Чат групи (singleton у DI): одне WebSocket-з'єднання на весь застосунок.
 *  - підключається після входу, відключається при виході;
 *  - при обриві перепідключається з експоненційною затримкою (1с, 2с, 4с … 15с);
 *  - тримає повідомлення в ObservableCollection, стан з'єднання, хто друкує, скільки онлайн;
 *  - рахує непрочитані, поки екран чату не відкритий (бейдж на вкладці).
 */
export class ChatService extends ObservableObject {
  readonly messages = new ObservableCollection<ChatMessage>();
  private ws: WebSocket | null = null;
  private _status: ChatStatus = 'offline';
  private _online = 0;
  private _unread = 0;
  private _typing: string | null = null;
  private typingTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private wanted = false;
  private viewing = false;
  private lastTypingSent = 0;

  constructor(
    private readonly api: ApiClient,
    private readonly log: ILogger,
  ) {
    super();
  }

  get status() { return this._status; }
  get online() { return this._online; }
  get unread() { return this._unread; }
  get typing() { return this._typing; }

  /** Підключитися (після входу в акаунт). */
  connect() {
    this.wanted = true;
    void this.loadHistory();
    this.open();
  }

  /** Відключитися й забути дані (вихід з акаунта). */
  disconnect() {
    this.wanted = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close();
    this.ws = null;
    this.messages.clear();
    this.set('status', 'offline');
    this.set('unread', 0);
  }

  /** Екран чату відкрито/закрито — для лічильника непрочитаних. */
  setViewing(viewing: boolean) {
    this.viewing = viewing;
    if (viewing) this.set('unread', 0);
  }

  send(text: string): boolean {
    const trimmed = text.trim();
    if (!trimmed || this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify({ type: 'message', text: trimmed }));
    return true;
  }

  /** Поставити / зняти реакцію (сервер розішле оновлення всім у кімнаті). */
  react(messageId: string, emoji: string) {
    if (this.ws?.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify({ type: 'react', messageId, emoji }));
  }

  /** «Друкує…» — не частіше ніж раз на 2 с. */
  notifyTyping() {
    const now = Date.now();
    if (now - this.lastTypingSent < 2000 || this.ws?.readyState !== WebSocket.OPEN) return;
    this.lastTypingSent = now;
    this.ws.send(JSON.stringify({ type: 'typing' }));
  }

  async loadHistory() {
    try {
      const { messages } = await this.api.chatHistory();
      this.messages.reset(messages);
    } catch (e) {
      this.log.warn('Chat history unavailable', { reason: e instanceof Error ? e.message : String(e) });
    }
  }

  private open() {
    const url = this.api.chatSocketUrl();
    if (!url || !this.wanted) return;
    this.set('status', 'connecting');
    const ws = new WebSocket(url);
    this.ws = ws;

    ws.onopen = () => {
      this.attempts = 0;
      this.set('status', 'online');
      this.log.info('Chat connected');
    };
    ws.onmessage = (e) => this.handle(String(e.data));
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      this.set('status', 'offline');
      if (e.code === 4001) {
        this.log.warn('Chat rejected: unauthorized');
        return;
      }
      this.scheduleReconnect();
    };
    ws.onerror = () => this.log.debug('Chat socket error');
  }

  private scheduleReconnect() {
    if (!this.wanted) return;
    const delay = Math.min(1000 * 2 ** this.attempts, MAX_BACKOFF);
    this.attempts++;
    this.log.debug('Chat reconnect scheduled', { delay });
    this.reconnectTimer = setTimeout(() => {
      void this.loadHistory(); // підтягуємо пропущене, поки були офлайн
      this.open();
    }, delay);
  }

  private handle(raw: string) {
    let event: ChatServerEvent;
    try {
      event = JSON.parse(raw);
    } catch {
      return;
    }
    if (event.type === 'message') {
      if (this.messages.items.some((m) => m.id === event.message.id)) return;
      this.messages.add(event.message);
      if (this._typing && event.message.author === this._typing) this.set('typing', null);
      if (!this.viewing) this.set('unread', this._unread + 1);
    } else if (event.type === 'reactions') {
      const m = this.messages.items.find((x) => x.id === event.messageId);
      if (m) this.messages.replace((x) => x.id === event.messageId, { ...m, reactions: event.reactions });
    } else if (event.type === 'presence') {
      this.set('online', event.online);
    } else if (event.type === 'typing') {
      this.set('typing', event.author);
      if (this.typingTimer) clearTimeout(this.typingTimer);
      this.typingTimer = setTimeout(() => this.set('typing', null), TYPING_TTL);
    }
  }

  private set<K extends 'status' | 'online' | 'unread' | 'typing'>(name: K, value: this[K]) {
    const field = `_${name}`;
    const self = this as unknown as Record<string, unknown>;
    this.setProperty(name, self[field], value, (v) => (self[field] = v));
  }
}
