import * as fs from 'node:fs/promises';
import type { ICapability, ITaskRequest, ITaskResponse } from '../interfaces/capabilities.js';
import type { IClaudeQueryFactory } from '../interfaces/claude.js';
import type { IScopeGuard } from '../interfaces/policy.js';

// Regex pre-pass: captures lines that look like bank transactions
// Format: date  description  amount  [balance]
const TX_REGEX =
  /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})\s+(.+?)\s+([-+]?\$?[\d,]+\.\d{2})/g;

interface RawTransaction {
  date: string;
  description: string;
  amount: string;
}

function regexPass(content: string): RawTransaction[] {
  const results: RawTransaction[] = [];
  let match: RegExpExecArray | null;
  while ((match = TX_REGEX.exec(content)) !== null) {
    results.push({
      date: match[1] ?? '',
      description: (match[2] ?? '').trim(),
      amount: match[3] ?? '',
    });
  }
  return results;
}

const SYSTEM_PROMPT = `You are Jeri, a financial data extraction specialist.
Extract ALL transactions from the bank statement into a JSON array.
Each transaction object must have:
  - date: ISO 8601 string (YYYY-MM-DD)
  - description: merchant or payee name, cleaned up
  - amount: number (negative for debits, positive for credits)
  - balanceAfter: number or null if not shown
  - category: best-guess category (e.g., "groceries", "utilities", "transfer", "unknown")

Return ONLY a JSON array — no other text.`;

export class ExtractTransactionsCapability implements ICapability {
  readonly name = 'extract_transactions';

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

    // Quick regex pre-pass to help the model
    const regexHints = regexPass(content);
    const hintsText = regexHints.length > 0
      ? `\nREGEX PRE-PASS (${regexHints.length} candidate transactions found):\n${JSON.stringify(regexHints.slice(0, 20), null, 2)}\n`
      : '';

    const prompt = `${SYSTEM_PROMPT}
${hintsText}
STATEMENT FILE: ${statementPath}

CONTENT:
${content}

Extract all transactions as a JSON array.`;

    try {
      const result = await this.factory.newBuilder()
        .withModel('sonnet')
        .query(prompt)
        .asText();

      return {
        status: 'ok',
        message: result,
        details: { statementPath, regexCandidates: regexHints.length },
      };
    } catch (err) {
      return { status: 'error', message: `Extraction failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}
