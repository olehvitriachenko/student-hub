/** Елемент черги офлайн-змін (лаб. 4). */
export type SyncOperation = 'Upsert' | 'Delete';

export interface SyncQueueItem {
  id: number;
  entityType: 'Student';
  entityId: string;
  operation: SyncOperation;
  /** JSON запису; чутливі поля залишаються зашифрованими, як і в основній таблиці. */
  payloadJson: string;
  createdAt: number;
  attempts: number;
}
