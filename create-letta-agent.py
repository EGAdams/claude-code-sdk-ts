#!/usr/bin/env python3
"""Create the jeri-agent on the Letta server.

Prerequisites:
  1. Build the SDK:      cd /home/adamsl/claude-code-sdk-ts && npm run build
  2. Start jeri A2A:    cd agents/jeri && bash start_jeri_agent.sh
  3. Ensure Letta is running at http://100.80.49.10:8283
  4. Run this script:   python create-letta-agent.py

The agent is registered with Jeri's persona, memory blocks, and tool set.
All five financial capabilities delegate to the local A2A server on port 9001.
"""

import json
import sys
from pathlib import Path

from letta_client import Letta

LETTA_SERVER = "http://100.80.49.10:8283"
JERI_A2A_URL = "http://10.0.0.143:9001"
SDK_ROOT = "/home/adamsl/claude-code-sdk-ts"
STATEMENTS_DIR = "/home/adamsl/rol_finances/readable_documents/bank_statements/january"

client = Letta(base_url=LETTA_SERVER)

# ── Memory blocks ──────────────────────────────────────────────────────────────

PERSONA_BLOCK = """I am Jeri, a stateful Letta agent with two specializations:

1. FINANCIAL STATEMENT ANALYST — January bank statements expert.
   I analyze, extract, summarize, and detect anomalies in bank statement files
   located in: {statements_dir}

2. CLAUDE-CODE-SDK-TS EXPERT — I master the TypeScript SDK at {sdk_root}.
   Two API layers:
   • Classic API: query() async generator yielding Message objects
   • Fluent API: claude() → QueryBuilder (chainable) → ResponseParser
                 (.asText(), .asJSON(), .asToolExecutions(), .stream(cb))

   Build commands: npm run build | npm test | npm run typecheck | npm run lint

   Data flow: claude().withModel(m).ask(prompt) → QueryBuilder builds opts
   → InternalClient.processQuery() → SubprocessCLITransport → spawns Claude CLI
   → yields parsed Messages → ResponseParser wraps results.

FIVE CORE CAPABILITIES (all callable via A2A at {a2a_url}):
  • analyze_statement      — deep structural analysis (dates, totals, merchants)
  • extract_transactions   — structured row extraction (regex + LLM)
  • summarize_statement    — natural language summary
  • prepare_report_snippet — Markdown table + narrative for rollup reports
  • find_anomalies         — z-score + LLM anomaly explanation

When I need to perform financial analysis I call my own A2A tools. When I need
to answer SDK questions I read files using read_sdk_file and run_typescript.
""".format(
    statements_dir=STATEMENTS_DIR,
    sdk_root=SDK_ROOT,
    a2a_url=JERI_A2A_URL,
)

HUMAN_BLOCK = """Adam Lawson (rbarnesrol@gmail.com) — the Mom's Machine Team lead.
Primary goal: process January bank statements for the rol_finances project.
Adam understands TypeScript and the claude-code-sdk-ts codebase well.
He wants Jeri to be autonomous: read files, extract data, and produce reports
without needing to be prompted step-by-step.
"""

SDK_CONTEXT_BLOCK = """claude-code-sdk-ts v0.3.3 — public API surface snapshot (2026-06-02):

Exports from src/index.ts:
  • query(prompt, options?) — classic async generator, yields Message objects
  • claude() — factory function returning QueryBuilder (fluent API)
  • ResponseParser — wraps generator, provides .asText() .asJSON() .stream() etc.
  • Logger, ConsoleLogger, JSONLogger, MultiLogger, NullLogger
  • ClaudeTelemetryProvider, createTelemetryProvider, TelemetryUtils
  • createRetryExecutor, createExponentialRetryExecutor, withRetry
  • createTokenStream, TokenStreamImpl
  • createPermissionManager, ToolPermissionManager
  • detectErrorType, createTypedError

QueryBuilder chain methods:
  .withModel(model) .allowTools(...) .denyTools(...) .withPermissions(mode)
  .skipPermissions() .acceptEdits() .inDirectory(cwd) .withEnv(env)
  .withTimeout(ms) .withSignal(signal) .withSessionId(id) .withLogger(l)
  .onMessage(cb) .onAssistant(cb) .onToolUse(cb) .withRole(name)
  .query(prompt) → ResponseParser

ResponseParser terminal methods:
  .asText() .asJSON() .asResult() .asArray() .asToolExecutions()
  .findToolResults(name) .findToolResult(name) .getUsage()
  .getSessionId() .succeeded() .stream(cb)

Feature modules: config/ roles/ permissions/ streaming/ retry/ telemetry/ errors/
"""

JANUARY_CONTEXT_BLOCK = """January statements processing context:

  statements_dir: {statements_dir}
  artifact_root:  ~/jeri_artifacts   (JERI_ARTIFACT_ROOT env var)
  a2a_server:     {a2a_url}
  letta_server:   {letta_server}

Processing status: Not yet started — ready for first analysis run.
Known bank accounts: TBD (to be discovered from statement files).
""".format(
    statements_dir=STATEMENTS_DIR,
    a2a_url=JERI_A2A_URL,
    letta_server=LETTA_SERVER,
)

# ── Load tool definitions from tools.py (for docstring-based schema gen) ──────

TOOLS_FILE = Path(SDK_ROOT) / "agents" / "jeri" / "letta" / "tools.py"

def load_tools_module():
    """Import the tools module so Letta can register each function."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("jeri_tools", TOOLS_FILE)
    if spec is None or spec.loader is None:
        return None
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

tools_module = load_tools_module()
TOOL_FUNCTIONS = []
if tools_module:
    TOOL_FUNCTIONS = [
        tools_module.read_sdk_file,
        tools_module.list_sdk_dir,
        tools_module.run_typescript,
        tools_module.analyze_statement,
        tools_module.extract_transactions,
        tools_module.summarize_statement,
        tools_module.prepare_report_snippet,
        tools_module.find_anomalies,
        tools_module.send_a2a_task,
        tools_module.send_letta_message,
    ]

# ── Create the agent ───────────────────────────────────────────────────────────

print("Creating jeri-agent on Letta server...")

agent_kwargs = dict(
    name="jeri-agent",
    model="google_ai/gemini-2.5-flash",
    embedding="letta/letta-free",
    memory_blocks=[
        {"label": "persona",         "value": PERSONA_BLOCK},
        {"label": "human",           "value": HUMAN_BLOCK},
        {"label": "sdk_context",     "value": SDK_CONTEXT_BLOCK},
        {"label": "january_context", "value": JANUARY_CONTEXT_BLOCK},
    ],
)

# Register tools if the module loaded successfully
if TOOL_FUNCTIONS:
    try:
        tool_ids = []
        for fn in TOOL_FUNCTIONS:
            t = client.tools.create_from_function(func=fn)
            tool_ids.append(t.id)
            print(f"  Registered tool: {t.name}  ({t.id})")
        agent_kwargs["tool_ids"] = tool_ids
    except Exception as e:
        print(f"  Warning: Could not register tools: {e}", file=sys.stderr)
else:
    print("  Warning: Could not load tools module — agent will have no tools", file=sys.stderr)

agent = client.agents.create(**agent_kwargs)

print(f"\njeri-agent created successfully!")
print(f"  Name:  {agent.name}")
print(f"  ID:    {agent.id}")
print(f"  Model: google_ai/gemini-2.5-flash")

# Primer message
print("\nSending primer message...")
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[
        {
            "role": "user",
            "content": (
                "Hello Jeri! You are now active. Please confirm your role: "
                "you are the January bank statement analyst and claude-code-sdk-ts expert "
                "for the Mom's Machine Team. What are your five core capabilities, "
                "and what is the statements directory you will process?"
            ),
        }
    ],
)

print("\nJeri's response:")
for msg in response.messages:
    if hasattr(msg, "content") and msg.content:
        content = msg.content
        if isinstance(content, list):
            for block in content:
                if hasattr(block, "text"):
                    print(f"  {block.text}")
        else:
            print(f"  {content}")

print(f"\nDone. Save this agent ID: {agent.id}")
print(f"A2A server should be running at: {JERI_A2A_URL}")
