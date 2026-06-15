import { claude } from '@instantlyeasy/claude-code-sdk-ts';
import type { ToolName } from '@instantlyeasy/claude-code-sdk-ts';
import type {
  IClaudeAgentSdkRunner,
  IMinionTaskRequest,
  IMinionTaskResult
} from '../interfaces/minion.js';

const DEFAULT_ALLOWED_TOOLS: readonly ToolName[] = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];

export interface ClaudeAgentSdkRunnerOptions {
  readonly cwd?: string;
  readonly model?: string;
  readonly timeoutMs?: number;
}

/**
 * Real `IClaudeAgentSdkRunner`: runs a minion's task as a Claude Agent SDK
 * session via the local `claude-code-sdk-ts` fluent API and reports a
 * structured `IMinionTaskResult`.
 */
export class ClaudeAgentSdkRunner implements IClaudeAgentSdkRunner {
  constructor(private readonly options: ClaudeAgentSdkRunnerOptions = {}) {}

  async run(request: IMinionTaskRequest): Promise<IMinionTaskResult> {
    const tools = (request.allowedTools as readonly ToolName[] | undefined) ?? DEFAULT_ALLOWED_TOOLS;

    let builder = claude().allowTools(...tools).acceptEdits();
    if (this.options.model) builder = builder.withModel(this.options.model);
    if (this.options.cwd) builder = builder.inDirectory(this.options.cwd);
    if (this.options.timeoutMs) builder = builder.withTimeout(this.options.timeoutMs);

    try {
      const parser = builder.query(buildPrompt(request));
      const output = await parser.asText();
      const usage = await parser.getUsage();
      const sessionId = await parser.getSessionId();
      const errors = await parser.getErrors();

      return {
        status: errors.length > 0 ? 'partial' : 'ok',
        output,
        ...(sessionId ? { sessionId } : {}),
        ...(usage
          ? {
              usage: {
                inputTokens: usage.inputTokens,
                outputTokens: usage.outputTokens,
                totalTokens: usage.totalTokens,
                totalCostUsd: usage.totalCost
              }
            }
          : {}),
        ...(errors.length > 0 ? { error: errors.join('; ') } : {})
      };
    } catch (err) {
      return {
        status: 'error',
        output: '',
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }
}

function buildPrompt(request: IMinionTaskRequest): string {
  const parts = [`Task (${request.role}, id=${request.taskId}): ${request.description}`];
  if (request.context && Object.keys(request.context).length > 0) {
    parts.push(`Context:\n${JSON.stringify(request.context, null, 2)}`);
  }
  return parts.join('\n\n');
}
