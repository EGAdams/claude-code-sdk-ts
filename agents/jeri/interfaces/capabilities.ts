import type { ICancellationToken, IResponseParser, IUsageReport } from './claude.js';
import type { IArtifactRef } from './documents.js';

export interface ITaskRequest {
  readonly capability: string;
  readonly description: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly correlationId: string;
  readonly cancellation: ICancellationToken;
}

export interface ITaskResponse {
  readonly status: 'ok' | 'error' | 'partial';
  readonly message: string;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly artifacts?: readonly IArtifactRef[];
  readonly usage?: IUsageReport;
}

export interface ICapability {
  readonly name: string;
  inputSchema?(): Readonly<Record<string, unknown>>;
  canHandle(request: ITaskRequest): boolean;
  execute(request: ITaskRequest): Promise<ITaskResponse>;
}

export interface ICapabilityRegistry {
  register(capability: ICapability): void;
  resolve(name: string): ICapability | undefined;
  list(): readonly ICapability[];
}

export interface ICapabilityDecorator {
  decorate(inner: ICapability): ICapability;
}

export interface IPromptTemplate {
  readonly id: string;
  render(vars: Readonly<Record<string, unknown>>): string;
}

export interface IPromptComposer {
  compose(template: IPromptTemplate, request: ITaskRequest): string;
}

export interface IResponseFormatter<T = unknown> {
  format(parser: IResponseParser): Promise<{ payload: T; response: ITaskResponse }>;
}
