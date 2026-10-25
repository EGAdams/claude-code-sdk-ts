import type { ITaskRequest, ITaskResponse } from './capabilities.js';

export interface IAgentIdentity {
  readonly name: string;
  readonly version: string;
  readonly primaryTopic: string;
  readonly topics: readonly string[];
}

export interface IAgentCard {
  identity(): IAgentIdentity;
  capabilities(): readonly { name: string; description?: string }[];
  memoryAccess(): 'none' | 'read-only' | 'read-write';
  runtime(): 'node' | 'python';
  toJSON(): Record<string, unknown>;
}

export interface ITopicSubscription {
  readonly topic: string;
  unsubscribe(): Promise<void>;
}

export interface IMessageObserver {
  onMessage(envelope: IInboundEnvelope): Promise<void>;
}

export interface IInboundEnvelope {
  readonly topic: string;
  readonly from: string;
  readonly correlationId: string;
  readonly kind: 'jsonrpc' | 'text';
  readonly payload: unknown;
}

export interface IMessengerClient {
  connect(): Promise<void>;
  subscribe(topic: string, observer: IMessageObserver): Promise<ITopicSubscription>;
  publish(topic: string, payload: unknown, correlationId?: string): Promise<void>;
  close(): Promise<void>;
}

export interface IRequestParser {
  parse(envelope: IInboundEnvelope): ITaskRequest;
}

export interface IResponsePublisher {
  publish(replyTo: IInboundEnvelope, response: ITaskResponse): Promise<void>;
}

export interface ITaskDispatcher {
  dispatch(request: ITaskRequest): Promise<ITaskResponse>;
}
