/** Повідомлення в чаті групи. */
export interface ChatMessage {
  id: string;
  room: string;
  userId: string;
  author: string;
  text: string;
  createdAt: number;
  /** emoji → id користувачів */
  reactions?: Record<string, string[]>;
}

export type ChatStatus = 'offline' | 'connecting' | 'online';

/** Події, що приходять із WebSocket. */
export type ChatServerEvent =
  | { type: 'message'; message: ChatMessage }
  | { type: 'typing'; userId: string; author: string }
  | { type: 'presence'; online: number }
  | { type: 'reactions'; messageId: string; reactions: Record<string, string[]> };

export const REACTIONS = ['👍', '❤️', '😂', '🔥', '😮', '🎉'] as const;
