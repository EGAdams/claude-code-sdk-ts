const JERI_A2A_PORT = process.env['JERI_A2A_PORT'] ?? '9001';
const JERI_HOST = process.env['JERI_HOST'] ?? '10.0.0.143';

export const AGENT_CARD = {
  name: 'Jeri',
  description:
    'January financial statement analyst and claude-code-sdk-ts expert. ' +
    'Analyzes bank statements, extracts transactions, detects anomalies, and produces rollup report snippets.',
  url: `http://${JERI_HOST}:${JERI_A2A_PORT}`,
  provider: { organization: 'rol-finances' },
  version: '1.0.0',
  capabilities: {
    streaming: true,
    pushNotifications: false,
  },
  defaultInputModes: ['application/json'],
  defaultOutputModes: ['application/json', 'text/plain'],
  skills: [
    {
      id: 'analyze_statement',
      name: 'Analyze Statement',
      description: 'Deep structural analysis of a bank statement — dates, totals, merchant breakdown',
      tags: ['finance', 'bank-statement', 'analysis'],
      examples: ['Analyze the January Chase statement at /path/to/file.txt'],
    },
    {
      id: 'extract_transactions',
      name: 'Extract Transactions',
      description: 'Extract structured transaction rows from a PDF or text bank statement',
      tags: ['finance', 'bank-statement', 'extraction'],
      examples: ['Extract all transactions from /path/to/statement.txt'],
    },
    {
      id: 'summarize_statement',
      name: 'Summarize Statement',
      description: 'Natural language summary: total in/out, top merchants, flags',
      tags: ['finance', 'bank-statement', 'summary'],
      examples: ['Summarize the January bank statement at /path/to/file.txt'],
    },
    {
      id: 'prepare_report_snippet',
      name: 'Prepare Report Snippet',
      description: 'Markdown table and narrative for monthly rollup reports',
      tags: ['finance', 'bank-statement', 'report'],
      examples: ['Prepare a report snippet for /path/to/statement.txt'],
    },
    {
      id: 'find_anomalies',
      name: 'Find Anomalies',
      description: 'Flag unusual or suspicious transactions using statistical analysis',
      tags: ['finance', 'bank-statement', 'anomaly-detection'],
      examples: ['Find anomalies in /path/to/statement.txt'],
    },
  ],
} as const;

export type AgentCard = typeof AGENT_CARD;
