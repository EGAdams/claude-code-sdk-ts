import type {
  IMessengerClient,
  IMessageObserver,
  ITopicSubscription,
} from '../interfaces/a2a.js';

// Stub messenger client for development.
// In production, replace with a WebSocket adapter targeting the orchestrator's
// A2A pub/sub bus.
export class StubMessengerClient implements IMessengerClient {
  async connect(): Promise<void> {
    console.log('[StubMessenger] connect() — no-op stub');
  }

  async subscribe(
    topic: string,
    _observer: IMessageObserver,
  ): Promise<ITopicSubscription> {
    console.log(`[StubMessenger] subscribed to topic "${topic}"`);
    return {
      topic,
      unsubscribe: async () => {
        console.log(`[StubMessenger] unsubscribed from "${topic}"`);
      },
    };
  }

  async publish(topic: string, payload: unknown, correlationId?: string): Promise<void> {
    console.log(`[StubMessenger] publish → ${topic}`, { correlationId, payload });
  }

  async close(): Promise<void> {
    console.log('[StubMessenger] close()');
  }
}
