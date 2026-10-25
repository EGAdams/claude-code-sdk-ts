import * as fs from 'node:fs/promises';
import type { ICapability, ITaskRequest, ITaskResponse } from '../interfaces/capabilities.js';
import type { IClaudeQueryFactory } from '../interfaces/claude.js';
import type { IScopeGuard } from '../interfaces/policy.js';

// Simple z-score anomaly detector
function detectOutliers(amounts: number[], threshold = 2.0): number[] {
  if (amounts.length < 3) return [];
  const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  const variance = amounts.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / amounts.length;
  const stdDev = Math.sqrt(variance);
  if (stdDev === 0) return [];

  const indices: number[] = [];
  amounts.forEach((amt, i) => {
    const z = Math.abs((amt - mean) / stdDev);
    if (z > threshold) indices.push(i);
  });
  return indices;
}

// Quick regex to extract numeric amounts from text
const AMOUNT_REGEX = /[-+]?\$?([\d,]+\.\d{2})/g;

function extractAmounts(content: string): { amounts: number[]; lines: string[] } {
  const lines = content.split('\n').filter(l => AMOUNT_REGEX.test(l));
  AMOUNT_REGEX.lastIndex = 0;
  const amounts: number[] = [];
  for (const line of lines) {
    const match = AMOUNT_REGEX.exec(line);
    if (match?.[1]) {
      const num = parseFloat(match[1].replace(',', ''));
      if (!isNaN(num) && num !== 0) amounts.push(num);
    }
    AMOUNT_REGEX.lastIndex = 0;
  }
  return { amounts, lines };
}

const SYSTEM_PROMPT = `You are Jeri, a financial fraud and anomaly detection specialist.
Review the provided bank statement and flagged transactions, then explain each anomaly.
For each flagged transaction explain:
1. Why it is statistically unusual (size, timing, or pattern)
2. Whether it looks like a legitimate large purchase, recurring charge, or potential error/fraud
3. Recommended action (review, dispute, ignore)

Format your response as a JSON array of anomaly objects with fields:
  - transactionDate: string
  - description: string
  - amount: number
  - anomalyReason: string
  - severity: "low" | "medium" | "high"
  - recommendedAction: string`;

export class FindAnomaliesCapability implements ICapability {
  readonly name = 'find_anomalies';

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

    // Statistical pre-pass
    const { amounts, lines } = extractAmounts(content);
    const outlierIndices = detectOutliers(amounts);
    const flaggedLines = outlierIndices
      .map(i => lines[i])
      .filter((l): l is string => l !== undefined);

    const statsSection = flaggedLines.length > 0
      ? `\nSTATISTICAL OUTLIERS (z-score > 2.0 from ${amounts.length} transactions):\n${flaggedLines.map(l => `  - ${l.trim()}`).join('\n')}\n`
      : '\nNo statistical outliers detected via regex pre-pass.\n';

    const prompt = `${SYSTEM_PROMPT}
${statsSection}
STATEMENT FILE: ${statementPath}

CONTENT:
${content}

Identify and explain all anomalous transactions.`;

    try {
      const result = await this.factory.newBuilder()
        .withModel('sonnet')
        .query(prompt)
        .asText();

      return {
        status: 'ok',
        message: result,
        details: {
          statementPath,
          statisticalFlagsCount: outlierIndices.length,
          totalAmountsSampled: amounts.length,
        },
      };
    } catch (err) {
      return { status: 'error', message: `Anomaly detection failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}
