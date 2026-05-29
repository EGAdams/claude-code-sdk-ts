#!/usr/bin/env python3
"""Create a Letta agent that uses Claude Code via the OpenAI-compatible proxy.

Prerequisites:
  1. Start the proxy server: npm run proxy
  2. Ensure your Letta server is running
  3. Run this script: python create-letta-agent.py

The proxy server (default http://localhost:4000) translates OpenAI chat
completions format into claude-code-sdk-ts calls.
"""

from letta_client import Letta

LETTA_SERVER = "http://10.0.0.143:8283"
PROXY_BASE_URL = "http://10.0.0.143:4000/v1"  # OpenAI-compatible proxy

client = Letta(base_url=LETTA_SERVER)

agent = client.agents.create(
    name="claude-ts-expert",
    # Use the openai provider prefix with our proxy's model id
    model="openai/claude-code",
    embedding="letta/letta-free",
    llm_config={
        "model": "claude-code",
        "model_endpoint_type": "openai",
        "model_endpoint": PROXY_BASE_URL,
        "context_window": 128000,
    },
    memory_blocks=[
        {
            "label": "persona",
            "value": (
                "I am claude-ts-expert, a specialist in the @instantlyeasy/claude-code-sdk-ts "
                "TypeScript SDK. This is an unofficial TypeScript port of the official Python "
                "Claude Code SDK. It wraps the Claude Code CLI via subprocess (NDJSON over "
                "stdin/stdout) and requires Node.js 18+.\n\n"
                "KEY COMMANDS:\n"
                "- npm run build (tsup, outputs CJS+ESM to dist/)\n"
                "- npm test (Vitest)\n"
                "- npm run typecheck (tsc --noEmit, strict mode)\n"
                "- npm run lint (ESLint)\n\n"
                "TWO API LAYERS:\n"
                "1. Classic API: query() async generator yielding Message objects\n"
                "2. Fluent API: claude() factory -> QueryBuilder (chainable) -> ResponseParser "
                "(.asText(), .asJSON(), .asToolExecutions())\n\n"
                "DATA FLOW: claude().withModel(...).ask(prompt) -> QueryBuilder builds options "
                "-> InternalClient.processQuery() -> SubprocessCLITransport.connect() -> "
                "spawns CLI -> yields parsed Messages -> ResponseParser wraps results.\n\n"
                "FEATURE MODULES (each self-contained with types):\n"
                "- config/: YAML/JSON config file loading with inheritance\n"
                "- roles/: Role definitions with inheritance and template variables\n"
                "- permissions/: MCP server permissions + per-call tool permissions\n"
                "- streaming/: Token-level streaming with pause/resume\n"
                "- retry/: Retry executor with exponential/linear/fibonacci backoff\n"
                "- telemetry/: Pluggable metrics (execution time, tokens, errors)\n"
                "- errors/: Error detection, classification, and resolution hints\n\n"
                "CONVENTIONS:\n"
                "- Strict TypeScript (noUnusedLocals, noUncheckedIndexedAccess, etc.)\n"
                "- File naming: lowercase with hyphens (subprocess-cli.ts)\n"
                "- Types in src/types/ as separate files per domain\n"
                "- Internal code in src/_internal/ (not re-exported)\n"
                "- Dependencies: execa (subprocess), js-yaml (config), which (CLI discovery)"
            ),
        },
        {
            "label": "human",
            "value": (
                "The user is a developer working with the claude-code-sdk-ts repository. "
                "They may ask about the SDK's fluent API, configuration, error handling, "
                "streaming, permissions, roles, retry logic, or how to extend the SDK."
            ),
        },
    ],
)

print(f"Agent created successfully!")
print(f"  Name: {agent.name}")
print(f"  ID:   {agent.id}")
print(f"  Model: openai/claude-code (via proxy at {PROXY_BASE_URL})")

# Send an initial message to prime the agent
response = client.agents.messages.create(
    agent_id=agent.id,
    messages=[
        {
            "role": "user",
            "content": (
                "Hello! You are now the claude-ts-expert agent. Your specialty is the "
                "claude-code-sdk-ts TypeScript SDK. Please confirm you understand your "
                "role and summarize the key things you know about this codebase."
            ),
        }
    ],
)

print(f"\nAgent response:")
for msg in response.messages:
    if hasattr(msg, "content") and msg.content:
        print(f"  {msg.content}")
