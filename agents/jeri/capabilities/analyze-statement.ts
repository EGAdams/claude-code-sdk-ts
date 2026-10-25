import * as fs from 'node:fs/promises';
import type { ICapability, ITaskRequest, ITaskResponse } from '../interfaces/capabilities.js';
import type { IClaudeQueryFactory } from '../interfaces/claude.js';
import type { IScopeGuard } from '../interfaces/policy.js';

const SYSTEM_PROMPT = `You are Jeri, a financial document analyst specializing in bank statements.
When analyzing a statement, always extract and report:
1. Account identifier (if present)
2. Statement period (start and end dates)
3. Opening and closing balances
4. Total credits and total debits
5. Top 10 merchants/payees by transaction count and volume
6. Any recurring charges or subscriptions
7. Unusual transactions worth flagging

Respond with a well-structured JSON object.`;

export class AnalyzeStatementCapability implements ICapability {
  readonly name = 'analyze_statement';

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

Analyze this bank statement and return structured JSON with all fields described above.`;

    try {
      const result = await this.factory.newBuilder()
        .withModel('sonnet')
        .query(prompt)
        .asText();

      return {
        status: 'ok',
        message: result,
        details: { statementPath, capability: this.name },
      };
    } catch (err) {
      return { status: 'error', message: `Analysis failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}
