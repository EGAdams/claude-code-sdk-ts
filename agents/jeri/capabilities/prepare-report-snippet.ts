import * as fs from 'node:fs/promises';
import type { ICapability, ITaskRequest, ITaskResponse } from '../interfaces/capabilities.js';
import type { IClaudeQueryFactory } from '../interfaces/claude.js';
import type { IScopeGuard } from '../interfaces/policy.js';
import type { IArtifactStore } from '../interfaces/documents.js';

const SYSTEM_PROMPT = `You are Jeri, a financial report writer.
Format the bank statement data as a Markdown report snippet suitable for inclusion in a monthly rollup report.

The snippet must include:
1. A header with account name and period
2. A summary table with columns: Category | Count | Total ($) | % of Spend
3. A one-paragraph narrative (3-5 sentences) highlighting key observations
4. A bullet list of action items or flags (if any)

Use clean Markdown formatting. Dollar amounts should be formatted with 2 decimal places.`;

export class PrepareReportSnippetCapability implements ICapability {
  readonly name = 'prepare_report_snippet';

  constructor(
    private readonly factory: IClaudeQueryFactory,
    private readonly scopeGuard: IScopeGuard,
    private readonly artifactStore: IArtifactStore,
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

Generate the Markdown report snippet now.`;

    try {
      const snippet = await this.factory.newBuilder()
        .withModel('opus')
        .query(prompt)
        .asText();

      // Save to artifact store
      const artifact = await this.artifactStore.put('report-snippet', snippet);

      return {
        status: 'ok',
        message: snippet,
        details: { statementPath },
        artifacts: [artifact],
      };
    } catch (err) {
      return { status: 'error', message: `Report failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  }
}
