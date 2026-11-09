/**
 * Аналог WeakReferenceMessenger (CommunityToolkit.Mvvm).
 * Дозволяє ViewModel'ям різних сторінок обмінюватись повідомленнями без прямих посилань.
 */
import type { Assignment } from '../../models/Assignment';
import type { Schedule } from '../../models/Lesson';

/** Реєстр усіх повідомлень застосунку: ключ — назва, значення — тип payload. */
export interface Messages {
  AssignmentSaved: Assignment;
  AssignmentDeleted: { id: string };
  AssignmentsSynced: { pulled: number; pushed: number };
  EventsChanged: { id: string };
  ScheduleLoaded: Schedule;
}

type Handler<K extends keyof Messages> = (payload: Messages[K]) => void;

export class Messenger {
  private readonly handlers = new Map<keyof Messages, Set<Handler<any>>>();

  register<K extends keyof Messages>(message: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(message);
    if (!set) this.handlers.set(message, (set = new Set()));
    set.add(handler);
    return () => set!.delete(handler);
  }

  send<K extends keyof Messages>(message: K, payload: Messages[K]): void {
    this.handlers.get(message)?.forEach((h) => h(payload));
  }
}
