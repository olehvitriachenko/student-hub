import { Command } from '../core/mvvm/Command';
import { ViewModelBase } from '../core/mvvm/ViewModelBase';
import type { ChatMessage } from '../models/ChatMessage';

export interface ReactionChip {
  emoji: string;
  count: number;
  mine: boolean;
}
import type { AuthService } from '../services/AuthService';
import type { ChatService } from '../services/ChatService';
import { formatDate, startOfDay } from '../utils/format';

export type ChatRow =
  | { kind: 'day'; key: string; label: string }
  | { kind: 'message'; key: string; message: ChatMessage; mine: boolean; showAuthor: boolean; showAvatar: boolean; reactions: ReactionChip[] };

/** Вкладка «Чат»: повідомлення групи, поле вводу, статус з'єднання. */
export class ChatViewModel extends ViewModelBase {
  private _draft = '';
  private _reactingTo: string | null = null;
  readonly sendCommand: Command;
  readonly reconnectCommand: Command;
  readonly openReactionsCommand: Command<string>;
  readonly closeReactionsCommand: Command;
  readonly reactCommand: Command<{ messageId: string; emoji: string }>;

  constructor(
    readonly chat: ChatService,
    private readonly auth: AuthService,
  ) {
    super();
    this.sendCommand = new Command(
      () => {
        if (this.chat.send(this._draft)) this.draft = '';
      },
      () => !!this._draft.trim() && this.chat.status === 'online',
    );
    this.reconnectCommand = new Command(() => chat.connect(), () => chat.status === 'offline');
    // Довге натискання на повідомлення відкриває панель реакцій.
    this.openReactionsCommand = new Command<string>((id) => this.setReacting(id));
    this.closeReactionsCommand = new Command(() => this.setReacting(null));
    this.reactCommand = new Command<{ messageId: string; emoji: string }>(
      ({ messageId, emoji }) => {
        this.chat.react(messageId, emoji);
        this.setReacting(null);
      },
      () => this.chat.status === 'online',
    );
    this.track(
      chat.subscribe(() => {
        this.onPropertyChanged('chat');
        this.sendCommand.raiseCanExecuteChanged();
        this.reconnectCommand.raiseCanExecuteChanged();
        this.reactCommand.raiseCanExecuteChanged();
      }),
    );
    this.track(chat.messages.subscribe(() => this.onPropertyChanged('rows')));
  }

  get draft() { return this._draft; }
  set draft(v: string) {
    if (this.setProperty('draft', this._draft, v, (x) => (this._draft = x))) {
      if (v) this.chat.notifyTyping();
      this.sendCommand.raiseCanExecuteChanged();
    }
  }

  get room() { return this.auth.user?.group ?? ''; }
  get reactingTo() { return this._reactingTo; }

  private setReacting(id: string | null) {
    this.setProperty('reactingTo', this._reactingTo, id, (v) => (this._reactingTo = v));
  }

  get statusText() {
    if (this.chat.status === 'online') return this.chat.typing ? `${this.chat.typing.split(' ')[1] ?? this.chat.typing} друкує…` : `${this.chat.online} онлайн`;
    return this.chat.status === 'connecting' ? 'підключення…' : 'офлайн';
  }

  /**
   * Рядки для інвертованого списку (найновіші першими):
   * роздільники днів + повідомлення; ім'я автора показуємо лише на початку серії.
   */
  get rows(): ChatRow[] {
    const me = this.auth.user?.id;
    const items = this.chat.messages.items;
    const rows: ChatRow[] = [];
    let lastDay = 0;
    items.forEach((m, i) => {
      const day = startOfDay(m.createdAt);
      if (day !== lastDay) {
        rows.push({ kind: 'day', key: `d-${day}`, label: day === startOfDay(Date.now()) ? 'Сьогодні' : formatDate(day) });
        lastDay = day;
      }
      const prev = items[i - 1];
      const next = items[i + 1];
      const showAuthor = !prev || prev.userId !== m.userId || startOfDay(prev.createdAt) !== day;
      // Аватар — біля останнього повідомлення серії, як у месенджерах.
      const showAvatar = !next || next.userId !== m.userId || startOfDay(next.createdAt) !== day;
      const reactions = Object.entries(m.reactions ?? {})
        .filter(([, users]) => users.length > 0)
        .map(([emoji, users]) => ({ emoji, count: users.length, mine: !!me && users.includes(me) }));
      rows.push({ kind: 'message', key: m.id, message: m, mine: m.userId === me, showAuthor, showAvatar, reactions });
    });
    return rows.reverse();
  }

  override onAppearing() {
    this.chat.setViewing(true);
  }

  override onDisappearing() {
    this.chat.setViewing(false);
  }
}
