// Offline Request Queue for Deferred Cloud Tasks
// Queues actions (e.g. pending text reading, scene snapshots) while offline and notifies when online
import type { OfflineQueueItem } from '../../types';
import { speechManager } from '../speechSynthesis';

const QUEUE_STORAGE_KEY = 'beyond_sight_offline_queue';

export class OfflineQueueService {
  private queue: OfflineQueueItem[] = [];

  constructor() {
    this.loadQueue();
  }

  private loadQueue(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
      }
    } catch {
      this.queue = [];
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
    } catch {
      // Ignore
    }
  }

  public enqueue(type: OfflineQueueItem['type'], data?: any): void {
    const item: OfflineQueueItem = {
      id: `queue_${Date.now()}_${Math.random().toString(36).substring(5)}`,
      type,
      data,
      createdAt: Date.now(),
    };
    this.queue.push(item);
    this.persist();
  }

  public getPendingCount(): number {
    return this.queue.length;
  }

  public clearQueue(): void {
    this.queue = [];
    this.persist();
  }

  /**
   * Called when connection returns: announces pending requests and handles them
   */
  public handleConnectionRestored(): void {
    if (this.queue.length === 0) return;

    const count = this.queue.length;
    speechManager.speakReply(
      `You have ${count} pending cloud request${count === 1 ? '' : 's'} saved while offline. Say "process pending" to run them now, or "clear queue" to discard.`
    );
  }
}

export const offlineQueueService = new OfflineQueueService();
