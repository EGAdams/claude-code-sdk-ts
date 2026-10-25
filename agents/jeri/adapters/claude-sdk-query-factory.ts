import { claude } from '@instantlyeasy/claude-code-sdk-ts';
import type { ToolName } from '@instantlyeasy/claude-code-sdk-ts';
import type {
  IClaudeQueryFactory,
  IQueryBuilder,
  IResponseParser,
  IToolPolicy,
  IPermissionStrategy,
  IWorkspacePolicy,
  ICancellationToken,
  IStreamSink,
  IToolExecution,
  IUsageReport,
  ClaudeModel,
} from '../interfaces/claude.js';
import type { Logger } from '@instantlyeasy/claude-code-sdk-ts';
import type { ResponseParser } from '@instantlyeasy/claude-code-sdk-ts';
import type { QueryBuilder } from '@instantlyeasy/claude-code-sdk-ts';
import type { Message } from '@instantlyeasy/claude-code-sdk-ts';

const MODEL_IDS: Record<ClaudeModel, string> = {
  opus: 'claude-opus-4-8-20251101',
  sonnet: 'claude-sonnet-4-6-20250514',
};

class ResponseParserAdapter implements IResponseParser {
  constructor(private readonly parser: ResponseParser) {}

  async asText(): Promise<string> {
    return this.parser.asText();
  }

  async asJSON<T = unknown>(): Promise<T> {
    const result = await this.parser.asJSON<T>();
    if (result === null) return {} as T;
    return result;
  }

  async asResult(): Promise<unknown> {
    return this.parser.asResult();
  }

  async asArray(): Promise<readonly unknown[]> {
    return this.parser.asArray();
  }

  async asToolExecutions(): Promise<readonly IToolExecution[]> {
    const execs = await this.parser.asToolExecutions();
    return execs.map(e => ({
      tool: e.tool,
      input: e.input,
      output: e.result,
      isError: e.isError,
    }));
  }

  async findToolResults(toolName: string): Promise<readonly unknown[]> {
    return this.parser.findToolResults(toolName);
  }

  async findToolResult(toolName: string): Promise<unknown | undefined> {
    const result = await this.parser.findToolResult(toolName);
    return result ?? undefined;
  }

  async getUsage(): Promise<IUsageReport> {
    const stats = await this.parser.getUsage();
    return {
      inputTokens: stats?.inputTokens ?? 0,
      outputTokens: stats?.outputTokens ?? 0,
      totalTokens: stats?.totalTokens ?? 0,
      totalCostUsd: stats?.totalCost ?? 0,
    };
  }

  async getSessionId(): Promise<string | undefined> {
    const id = await this.parser.getSessionId();
    return id ?? undefined;
  }

  async succeeded(): Promise<boolean> {
    return this.parser.succeeded();
  }

  async stream(sink: IStreamSink): Promise<void> {
    try {
      await this.parser.stream(async (message: Message) => {
        if (message.type === 'assistant') {
          for (const block of message.content) {
            if (block.type === 'text') {
              await sink.onAssistantText(block.text);
            } else if (block.type === 'tool_use') {
              await sink.onToolUse(block.name, block.input);
            }
          }
        }
      });
      await sink.onDone();
    } catch (err) {
      await sink.onError(err instanceof Error ? err : new Error(String(err)));
    }
  }
}

class QueryBuilderAdapter implements IQueryBuilder {
  private readonly builder: QueryBuilder;

  constructor(builder: QueryBuilder) {
    this.builder = builder;
  }

  withModel(model: ClaudeModel): this {
    this.builder.withModel(MODEL_IDS[model]);
    return this;
  }

  withTimeoutMs(ms: number): this {
    this.builder.withTimeout(ms);
    return this;
  }

  withToolPolicy(policy: IToolPolicy): this {
    if (policy.readOnly()) {
      this.builder.allowTools();
    } else {
      const allowed = policy.allow();
      if (allowed.length > 0) {
        this.builder.allowTools(...(allowed as ToolName[]));
      }
      const denied = policy.deny();
      if (denied.length > 0) {
        this.builder.denyTools(...(denied as ToolName[]));
      }
    }
    return this;
  }

  withPermissionStrategy(strategy: IPermissionStrategy): this {
    if (strategy.skipPermissions()) {
      this.builder.skipPermissions();
    } else if (strategy.acceptEdits()) {
      this.builder.acceptEdits();
    }
    return this;
  }

  withWorkspace(policy: IWorkspacePolicy): this {
    this.builder.inDirectory(policy.primaryDir());
    const others = policy.additionalDirs();
    if (others.length > 0) {
      this.builder.addDirectory([...others]);
    }
    const env = { ...policy.env() };
    if (Object.keys(env).length > 0) {
      this.builder.withEnv(env);
    }
    return this;
  }

  withSessionId(id: string): this {
    this.builder.withSessionId(id);
    return this;
  }

  withCancellation(token: ICancellationToken): this {
    this.builder.withSignal(token.signal);
    return this;
  }

  withLogger(logger: Logger): this {
    this.builder.withLogger(logger);
    return this;
  }

  withRole(name: string, _vars?: Record<string, string>): this {
    this.builder.withRole(name);
    return this;
  }

  withConfigFile(_path: string): this {
    return this;
  }

  onMessage(cb: (m: unknown) => void): this {
    this.builder.onMessage(cb as (m: Message) => void);
    return this;
  }

  onAssistant(cb: (m: unknown) => void): this {
    this.builder.onAssistant(cb as Parameters<typeof this.builder.onAssistant>[0]);
    return this;
  }

  onToolUse(cb: (t: unknown) => void): this {
    this.builder.onToolUse(cb as Parameters<typeof this.builder.onToolUse>[0]);
    return this;
  }

  onError(_cb: (e: Error) => void): this {
    return this;
  }

  query(prompt: string): IResponseParser {
    return new ResponseParserAdapter(this.builder.query(prompt));
  }
}

export class ClaudeSdkQueryFactory implements IClaudeQueryFactory {
  newBuilder(opts?: {
    model?: ClaudeModel;
    tools?: IToolPolicy;
    permissions?: IPermissionStrategy;
    workspace?: IWorkspacePolicy;
    sessionId?: string;
    cancellation?: ICancellationToken;
  }): IQueryBuilder {
    let builder: IQueryBuilder = new QueryBuilderAdapter(claude());

    if (opts?.model) builder = builder.withModel(opts.model);
    if (opts?.tools) builder = builder.withToolPolicy(opts.tools);
    if (opts?.permissions) builder = builder.withPermissionStrategy(opts.permissions);
    if (opts?.workspace) builder = builder.withWorkspace(opts.workspace);
    if (opts?.sessionId) builder = builder.withSessionId(opts.sessionId);
    if (opts?.cancellation) builder = builder.withCancellation(opts.cancellation);

    return builder;
  }
}
