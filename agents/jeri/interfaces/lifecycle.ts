import type { IMessengerClient, IAgentCard } from './a2a.js';
import type { ICapabilityRegistry } from './capabilities.js';

export interface IContainer {
  resolve<T>(token: symbol): T;
  register<T>(token: symbol, factory: (c: IContainer) => T): void;
}

export interface IProcessLifecycle {
  start(): Promise<void>;
  stop(reason?: string): Promise<void>;
  onShutdown(cb: () => Promise<void> | void): void;
}

export interface IPidFile {
  readonly path: string;
  write(pid: number): Promise<void>;
  read(): Promise<number | undefined>;
  remove(): Promise<void>;
}

export interface IHealthCheck {
  ping(): Promise<{ ok: boolean; details?: Record<string, unknown> }>;
}

export interface IFinancialAgent {
  readonly card: IAgentCard;
  start(): Promise<void>;
  stop(reason?: string): Promise<void>;
}

export interface ITokens {
  readonly Container: symbol;
  readonly Agent: symbol;
  readonly Messenger: symbol;
  readonly Registry: symbol;
  readonly ClaudeFactory: symbol;
  readonly DocumentRepository: symbol;
  readonly ArtifactStore: symbol;
  readonly ScopeGuard: symbol;
  readonly LoggerFactory: symbol;
  readonly Clock: symbol;
  readonly SessionStore: symbol;
  readonly Telemetry: symbol;
}

export type { ICapabilityRegistry, IMessengerClient, IAgentCard };
