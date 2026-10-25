// TypeScript ↔ Letta bridge (informational — Letta tools are implemented in tools.py)
// This file documents the mapping between Letta tool names and A2A skill IDs.

export const LETTA_TO_A2A_SKILL_MAP: Record<string, string> = {
  analyze_statement: 'analyze_statement',
  extract_transactions: 'extract_transactions',
  summarize_statement: 'summarize_statement',
  prepare_report_snippet: 'prepare_report_snippet',
  find_anomalies: 'find_anomalies',
};

// Tools that are internal-only (not exposed via A2A)
export const INTERNAL_TOOLS = ['read_sdk_file', 'list_sdk_dir', 'run_typescript'] as const;

// Tools that are outbound-only (Jeri uses them to call others)
export const OUTBOUND_TOOLS = ['send_a2a_task', 'send_letta_message'] as const;
