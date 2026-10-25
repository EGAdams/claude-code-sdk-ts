import * as fs from 'node:fs/promises';
import type { ICapability, ITaskRequest, ITaskResponse } from '../interfaces/capabilities.js';
import type { IClaudeQueryFactory } from '../interfaces/claude.js';
import type { IScopeGuard } from '../interfaces/policy.js';

const SYSTEM_PROMPT = `You are Jeri, a financial statement summarizer.
Write a clear, concise natural language summary of the bank statement covering:
1. Statement period and account info
2. Total money in vs money out
3. Top 5 merchants or payees by spending
4. Any notable patterns (subscriptions, large one-off charges, etc.)
5. Overall financial health indicators visible in this statement

Keep the summary under 300 words. Be factual and specific with dollar amounts.`;

export class SummarizeStatementCapability implements ICapability {
  readonly name = 'summarize_statement';

  constructor(
    private readonly factory: IClaudeQueryFactory,
    private readonly scopeGuard: IScopeGuard,
  ) {}

  canHandle(request: ITaskRequest): boolean {
    return request.capability === this.name;
  }

  async execute(request: ITaskRequest): Promise<ITaskResponse> {
    const statementPath = request.context?.['statementPath'];
    if (typeof statementPath !== 'string') {
      return { status: 'error', message: 'Missing or invalid statementPath in context' };
    }

    try {
      this.scopeGuard.ensurePathInScope(statementPath);
    } catch (err) {
      return { status: 'error', message: `Scope violation: ${err instanceof Error ? err.message : String(err)}` };
    }

    let content: string;
    try {
      content = await fs.readFile(statementPath, 'utf-8');
    } catch (err) {
      return { status: 'error', message: `Cannot read file: ${err instanceof Error ? err.message : String(err)}` };
    }

    const prompt = `${SYSTEM_PROMPT}

STATEMENT FILE: ${statementPath}

CONTENT:
${content}

Write the summary now.`;

    try {
      const result = await this.factory.newBuilder()
        .withModel('sonnet')
        .query(prompt)
        .asText();

      return {
        status: 'ok',
        message: result,
        details: { statementPath },
      };
    } catch (err) {
      return { status: 'error', message: `Summary failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}
