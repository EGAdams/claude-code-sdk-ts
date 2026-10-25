import type { Logger, LogLevel, LogEntry } from '@instantlyeasy/claude-code-sdk-ts';

export type ClaudeModel = 'opus' | 'sonnet';

export interface IToolPolicy {
  allow(): readonly string[];
  deny(): readonly string[];
  readOnly(): boolean;
}

export interface IPermissionStrategy {
  skipPermissions(): boolean;
  acceptEdits(): boolean;
  mode(): 'default' | 'skip' | 'accept-edits';
}

export interface IWorkspacePolicy {
  primaryDir(): string;
  additionalDirs(): readonly string[];
  env(): Readonly<Record<string, string>>;
}

export interface ICancellationToken {
  readonly signal: AbortSignal;
  cancel(reason?: string): void;
  isCancelled(): boolean;
}

export interface IQueryBuilder {
  withModel(model: ClaudeModel): this;
  withTimeoutMs(ms: number): this;
  withToolPolicy(policy: IToolPolicy): this;
  withPermissionStrategy(strategy: IPermissionStrategy): this;
  withWorkspace(policy: IWorkspacePolicy): this;
  withSessionId(id: string): this;
  withCancellation(token: ICancellationToken): this;
  withLogger(logger: Logger): this;
  withRole(name: string, vars?: Record<string, string>): this;
  withConfigFile(path: string): this;
  onMessage(cb: (m: unknown) => void): this;
  onAssistant(cb: (m: unknown) => void): this;
  onToolUse(cb: (t: unknown) => void): this;
  onError(cb: (e: Error) => void): this;
  query(prompt: string): IResponseParser;
}

export interface IResponseParser {
  asText(): Promise<string>;
  asJSON<T = unknown>(): Promise<T>;
  asResult(): Promise<unknown>;
  asArray(): Promise<readonly unknown[]>;
  asToolExecutions(): Promise<readonly IToolExecution[]>;
  findToolResults(toolName: string): Promise<readonly unknown[]>;
  findToolResult(toolName: string): Promise<unknown | undefined>;
  getUsage(): Promise<IUsageReport>;
  getSessionId(): Promise<string | undefined>;
  succeeded(): Promise<boolean>;
  stream(sink: IStreamSink): Promise<void>;
}

export interface IClaudeQueryFactory {
  newBuilder(opts?: {
    model?: ClaudeModel;
    tools?: IToolPolicy;
    permissions?: IPermissionStrategy;
    workspace?: IWorkspacePolicy;
    sessionId?: string;
    cancellation?: ICancellationToken;
  }): IQueryBuilder;
}

export interface IStreamSink {
  onAssistantText(text: string): Promise<void> | void;
  onToolUse(toolName: string, input: unknown): Promise<void> | void;
  onDone(): Promise<void> | void;
  onError(err: Error): Promise<void> | void;
}

export interface IToolExecution {
  readonly tool: string;
  readonly input: unknown;
  readonly output: unknown;
  readonly isError: boolean;
}

export interface IUsageReport {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly totalCostUsd: number;
}

export interface ILoggerFactory {
  create(level: LogLevel, prefix?: string): Logger;
  fanOut(loggers: readonly Logger[]): Logger;
}

export type { Logger, LogEntry, LogLevel };
