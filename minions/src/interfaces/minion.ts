/**
 * Phase 0 contract for Mazda's minions.
 *
 * A minion is a Letta agent whose job is to drive a Claude Agent SDK session
 * for one slice of Mazda's work and report a structured result back.
 * `IClaudeAgentSdkRunner` is the SDK boundary (mirrors the role played by
 * `IClaudeQueryFactory`/`IQueryBuilder`/`IResponseParser` in jeris_ts_blueprint.md,
 * collapsed to the single call a minion needs: run a task, get a result).
 */

/** The 5 existing Mazda minion agents, repurposed under the new direction. */
export type MinionRole =
  | 'router'
  | 'parser'
  | 'vendor-identity'
  | 'receipt-linker'
  | 'categorization';

/** Task envelope a minion receives from Mazda via send_letta_message. */
export interface IMinionTaskRequest {
  readonly taskId: string;
  readonly role: MinionRole;
  readonly description: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly allowedTools?: readonly string[];
}

export interface IMinionUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
  readonly totalCostUsd: number;
}

/** Structured result a minion reports back to Mazda. */
export interface IMinionTaskResult {
  readonly status: 'ok' | 'error' | 'partial';
  readonly output: string;
  readonly artifacts?: Readonly<Record<string, unknown>>;
  readonly usage?: IMinionUsage;
  readonly sessionId?: string;
  readonly error?: string;
}

/**
 * Boundary port to the Claude Agent SDK: given a task envelope, run a session,
 * return a structured result. Implementations wrap `claude().query(...)` from
 * `@instantlyeasy/claude-code-sdk-ts`; domain code never sees the SDK directly.
 */
export interface IClaudeAgentSdkRunner {
  run(request: IMinionTaskRequest): Promise<IMinionTaskResult>;
}

/**
 * A minion: a role-scoped wrapper over a runner. Mazda calls `handle()` for
 * every task delegated to this minion's role.
 */
export interface IMinion {
  readonly role: MinionRole;
  handle(request: IMinionTaskRequest): Promise<IMinionTaskResult>;
}
