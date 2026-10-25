import type { IDocumentRef } from './documents.js';
import type { ICapability } from './capabilities.js';

export interface IPathPolicy {
  isAllowed(absPath: string): boolean;
  explain(absPath: string): string;
}

export interface IScopeGuard {
  ensureInScope(ref: IDocumentRef): void;
  ensurePathInScope(absPath: string): void;
  withOverride(allowed: readonly string[]): IScopeGuard;
}

export interface IRetryStrategy {
  readonly name: 'exponential' | 'linear' | 'fibonacci' | 'fixed';
  nextDelayMs(attempt: number): number;
  shouldRetry(error: unknown, attempt: number): boolean;
}

export interface IRetryPolicy {
  readonly maxAttempts: number;
  readonly strategy: IRetryStrategy;
}

export interface ICircuitBreaker {
  allow(): boolean;
  recordSuccess(): void;
  recordFailure(err: unknown): void;
  state(): 'closed' | 'open' | 'half-open';
}

export interface IErrorClassifier {
  classify(err: unknown): IClassifiedError | undefined;
  next?: IErrorClassifier;
}

export interface IClassifiedError {
  readonly category:
    | 'network'
    | 'authentication'
    | 'permission'
    | 'timeout'
    | 'validation'
    | 'cli'
    | 'configuration'
    | 'scope'
    | 'parse'
    | 'unknown';
  readonly retryable: boolean;
  readonly resolution?: string;
  readonly original: unknown;
}

export interface IErrorRecoveryStrategy {
  recover(err: IClassifiedError): Promise<'retry' | 'fail' | 'fallback'>;
}

export interface ICapabilityWrapper {
  withRetry(policy: IRetryPolicy): ICapabilityWrapper;
  withTelemetry(): ICapabilityWrapper;
  withScope(guard: IScopeGuard): ICapabilityWrapper;
  withCircuitBreaker(cb: ICircuitBreaker): ICapabilityWrapper;
  build(inner: ICapability): ICapability;
}
