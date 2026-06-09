#!/usr/bin/env python3
"""
setup_jeri.py — Configure Jeri as a financial document analysis specialist.

What this script does:
  1. Replaces Jeri's generic system prompt.
  2. Detaches SDK-dev tools (list_sdk_dir, read_sdk_file, run_typescript).
  3. Registers and attaches 3 utility tools (Mazda agent IDs hardcoded inside them).
  4. Initialises Jeri's memfs git memory with persona + delegation map markdown files.
  5. Tags the agent with git-memory-enabled so memfs activates on next startup.

NOTE: This server (Letta 0.16.7 at 100.80.49.10:8283) has a known block-write bug —
PATCH /v1/blocks returns HTTP 500. We do NOT call update_block(). All durable
memory goes into memfs markdown files instead.

Usage:
  python setup_jeri.py

Prerequisites:
  pip install letta-client
  git must be on PATH
"""

from __future__ import annotations

import os
import json
import subprocess
import tempfile
from pathlib import Path

from letta_client import Letta

# ── Config ────────────────────────────────────────────────────────────────────

LETTA_SERVER  = "http://100.80.49.10:8283"
LETTA_API_KEY = os.environ.get("LETTA_API_KEY", "")          # empty = no auth on self-hosted
JERI_AGENT_ID = "agent-1caa2fff-5188-4f7e-996b-34146de966e3"

TARGET_DIR     = "/home/adamsl/rol_finances/readable_documents/bank_statements/january"
ARTIFACT_ROOT  = str(Path.home() / "jeri_artifacts")

# Tools to detach — belonged to a different agent (SDK dev bot)
SDK_DEV_TOOLS = {"list_sdk_dir", "read_sdk_file", "run_typescript"}

# Mazda specialist agent IDs — hardcoded here AND inside every tool function
# so Jeri never needs a memory lookup to know who to call.
MAZDA_ROUTER        = "agent-bc561f63-a5bd-4192-806e-58d92593da2b"
MAZDA_PARSER        = "agent-a5063757-46c7-4054-a07d-2b1263db43a8"
MAZDA_CATEGORIZER   = "agent-c429ff25-c8af-4f1a-a6f1-6d48307e2874"
MAZDA_RECEIPT_LINKER = "agent-9a14f800-d848-4914-bfd4-53ab62bc177b"
MAZDA_VENDOR_ID     = "agent-acd624ac-17f2-4a74-aa34-78036cac4d66"

# ── System prompt ─────────────────────────────────────────────────────────────

JERI_SYSTEM_PROMPT = """You are Jeri, a financial document analysis specialist and persistent Letta agent.

## Mission
Analyze January bank statements for the rol_finances project.
  Target dir:    /home/adamsl/rol_finances/readable_documents/bank_statements/january
  Artifact root: ~/jeri_artifacts/

## How you work
You are autonomous. When given a task, execute it immediately. Do not describe what you
are about to do and then wait. Use your tools, produce results, save artifacts.

## Your tools (owned directly)
- list_january_statements  — inventory the statement files
- read_statement_file      — read raw file text (scope-guarded)
- save_artifact            — persist outputs to ~/jeri_artifacts/
- send_letta_message       — delegate to specialist Mazda agents

## Delegation — Mazda specialist agents
For all Claude-powered analysis use send_letta_message. The IDs are in your memory
at system/mazda_agents.md — they are also hardcoded in every tool so you never need
to look them up at runtime.

| Task                                    | Agent                     |
|-----------------------------------------|---------------------------|
| Parse / analyze / extract / summarize   | mazda-parser-agent        |
| Anomaly detection / categorization      | mazda-categorization-agent|
| Link receipts to transactions           | mazda-receipt-linker-agent|
| Identify vendor from description        | mazda-vendor-identity-agent|
| Multi-step or ambiguous tasks           | mazda-router-agent        |

## Standard workflow
1. list_january_statements → see what files exist
2. read_statement_file(name) → get raw text
3. send_letta_message(<parser-agent-id>, "<task>\\n\\n<file text>") → get analysis
4. save_artifact(kind, filename, result) → persist output

## Scope rules
You only access files under the target directory or artifact root. Refuse anything else.

## Memory
Your memory lives in memfs (git-backed markdown files). Key files:
  system/persona.md        — your identity
  system/mazda_agents.md   — delegation map with hardcoded IDs
  context/january.md       — processing status, file inventory, findings
"""

# ── memfs markdown files ──────────────────────────────────────────────────────

MEMFS_FILES = {
    "system/persona.md": f"""\
# Jeri — Financial Document Analysis Specialist

I am Jeri, a persistent Letta agent specialising in financial document analysis.

## Primary mission
Analyze January bank statements for the rol_finances project.

- **Target dir:** /home/adamsl/rol_finances/readable_documents/bank_statements/january
- **Artifact root:** ~/jeri_artifacts/

## My tools
- `list_january_statements` — inventory files
- `read_statement_file` — read raw file text (scope-guarded)
- `save_artifact` — persist outputs
- `send_letta_message` — delegate to Mazda specialist agents

## Delegation pattern
1. List files → pick target
2. Read file → get raw text
3. send_letta_message(parser-agent, task + text) → get analysis
4. save_artifact(kind, filename, result) → persist

All Claude-heavy work goes to the Mazda agents. I do not call Claude directly.
""",

    "system/mazda_agents.md": f"""\
# Mazda Specialist Agents

These IDs are hardcoded in every tool function. This file is the human-readable reference.

| Agent name                  | Agent ID                                      | Use for |
|-----------------------------|-----------------------------------------------|---------|
| mazda-router-agent          | {MAZDA_ROUTER}   | Multi-step or ambiguous tasks |
| mazda-parser-agent          | {MAZDA_PARSER}   | Parse, analyze, extract transactions, summarize |
| mazda-categorization-agent  | {MAZDA_CATEGORIZER} | Anomaly detection, transaction categorization |
| mazda-receipt-linker-agent  | {MAZDA_RECEIPT_LINKER} | Link receipts to transactions |
| mazda-vendor-identity-agent | {MAZDA_VENDOR_ID} | Identify vendor from transaction description |

## How to call them
Use the `send_letta_message` tool:
```
send_letta_message(
    agent_id="<id from table above>",
    message="<task description>\\n\\n<statement text>"
)
```

## Letta server
{LETTA_SERVER}
""",

    "context/january.md": """\
# January Statements — Processing Context

**Statements dir:** /home/adamsl/rol_finances/readable_documents/bank_statements/january
**Artifact root:** ~/jeri_artifacts/
**Status:** Not started

## File inventory
_Run list_january_statements and update this section._

## Processing log
_Record each file processed, date, and output artifact path._

## Findings
_Notable anomalies or items for manual review._
""",
}

# ── Tool implementations ──────────────────────────────────────────────────────
# Mazda agent IDs are hardcoded constants inside each function that needs them.
# No memory lookup required at runtime.

def list_january_statements() -> str:
    """List all files in the January bank statements directory.

    Returns:
        str: JSON array of objects with name, path, size_bytes, modified_at.
    """
    import os
    import json
    from datetime import datetime

    TARGET = "/home/adamsl/rol_finances/readable_documents/bank_statements/january"

    if not os.path.isdir(TARGET):
        return f"ERROR: Target directory does not exist: {TARGET}"

    files = []
    for entry in sorted(os.scandir(TARGET), key=lambda e: e.name):
        if entry.is_file():
            stat = entry.stat()
            files.append({
                "name": entry.name,
                "path": entry.path,
                "size_bytes": stat.st_size,
                "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
            })

    return json.dumps(files, indent=2)


def read_statement_file(file_name: str) -> str:
    """Read the raw text of a January bank statement file.

    Args:
        file_name (str): Filename only (e.g. "chase_january.txt"). No path traversal.

    Returns:
        str: File contents, or an error message prefixed with ERROR:.
    """
    import os

    TARGET = "/home/adamsl/rol_finances/readable_documents/bank_statements/january"

    safe = os.path.basename(file_name)
    if safe != file_name:
        return f"ERROR: Path traversal not allowed. Use filename only, got: {file_name}"

    full  = os.path.join(TARGET, safe)
    if not os.path.realpath(full).startswith(os.path.realpath(TARGET)):
        return f"ERROR: Access denied — path outside target directory."
    if not os.path.isfile(full):
        return f"ERROR: File not found: {safe}"

    try:
        with open(full, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        return f"ERROR: {e}"


def save_artifact(kind: str, file_name: str, content: str) -> str:
    """Save generated content to the artifact root directory.

    Mazda agent IDs (hardcoded — no lookup needed):
      router:      agent-bc561f63-a5bd-4192-806e-58d92593da2b
      parser:      agent-a5063757-46c7-4054-a07d-2b1263db43a8
      categorizer: agent-c429ff25-c8af-4f1a-a6f1-6d48307e2874
      receipts:    agent-9a14f800-d848-4914-bfd4-53ab62bc177b
      vendors:     agent-acd624ac-17f2-4a74-aa34-78036cac4d66

    Args:
        kind (str): One of: summary, transactions-csv, anomaly-report, report-snippet.
        file_name (str): Output filename (e.g. "chase_summary.md"). No path traversal.
        content (str): Text content to save.

    Returns:
        str: Full path where the artifact was saved, or an error message.
    """
    import os
    from pathlib import Path

    ARTIFACT_ROOT = os.environ.get("JERI_ARTIFACT_ROOT", str(Path.home() / "jeri_artifacts"))
    ALLOWED_KINDS = {"summary", "transactions-csv", "anomaly-report", "report-snippet"}

    if kind not in ALLOWED_KINDS:
        return f"ERROR: Unknown kind '{kind}'. Allowed: {', '.join(sorted(ALLOWED_KINDS))}"

    safe = os.path.basename(file_name)
    if safe != file_name:
        return f"ERROR: Path traversal not allowed: {file_name}"

    kind_dir = os.path.join(ARTIFACT_ROOT, kind)
    os.makedirs(kind_dir, exist_ok=True)

    out   = os.path.join(kind_dir, safe)
    if not os.path.realpath(out).startswith(os.path.realpath(ARTIFACT_ROOT)):
        return "ERROR: Access denied — path outside artifact root."

    with open(out, "w", encoding="utf-8") as f:
        f.write(content)
    return f"Saved to {out}"


# ── memfs initialisation ──────────────────────────────────────────────────────

def init_memfs(agent_id: str, letta_server: str, api_key: str) -> None:
    """Clone Jeri's memfs git repo, write memory files, commit, and push."""

    remote_url = f"{letta_server}/v1/git/{agent_id}/state.git"
    # HTTP Basic auth — empty password is fine on no-auth self-hosted instances
    auth_url = remote_url.replace("http://", f"http://letta:{api_key}@")

    with tempfile.TemporaryDirectory() as tmpdir:
        repo = Path(tmpdir) / "memory"

        # Try to clone; if repo is empty (new agent) init from scratch
        result = subprocess.run(
            ["git", "clone", auth_url, str(repo)],
            capture_output=True, text=True
        )
        if result.returncode != 0:
            print(f"   ! Clone failed ({result.stderr.strip()}), initialising fresh repo...")
            repo.mkdir()
            subprocess.run(["git", "init"], cwd=repo, check=True, capture_output=True)
            subprocess.run(
                ["git", "remote", "add", "origin", auth_url],
                cwd=repo, check=True, capture_output=True
            )

        # Write markdown files
        for rel_path, text in MEMFS_FILES.items():
            dest = repo / rel_path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(text, encoding="utf-8")
            print(f"   wrote {rel_path}")

        env = {**os.environ, "GIT_AUTHOR_NAME": "setup_jeri", "GIT_AUTHOR_EMAIL": "setup@jeri",
               "GIT_COMMITTER_NAME": "setup_jeri", "GIT_COMMITTER_EMAIL": "setup@jeri"}

        subprocess.run(["git", "add", "-A"], cwd=repo, check=True, capture_output=True, env=env)

        diff = subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=repo, env=env)
        if diff.returncode != 0:
            subprocess.run(
                ["git", "commit", "-m", "feat: initialise Jeri financial-specialist memory"],
                cwd=repo, check=True, capture_output=True, env=env
            )
            push = subprocess.run(
                ["git", "push", "-u", "origin", "HEAD:main", "--force"],
                cwd=repo, capture_output=True, text=True, env=env
            )
            if push.returncode == 0:
                print("   ✓ Pushed to server git repo.")
            else:
                print(f"   ! Push failed: {push.stderr.strip()}")
                print("     You can push manually later with: letta memfs sync")
        else:
            print("   No changes to commit.")


# ── Setup orchestration ───────────────────────────────────────────────────────

def main() -> None:
    client = Letta(base_url=LETTA_SERVER)
    print(f"Configuring Jeri ({JERI_AGENT_ID})\n")

    # 1. Replace system prompt
    print("1. Updating system prompt...")
    client.agents.update(agent_id=JERI_AGENT_ID, system=JERI_SYSTEM_PROMPT)
    print("   ✓ Done.\n")

    # 2. Detach SDK-dev tools
    print("2. Detaching SDK-dev tools...")
    current = client.agents.retrieve(agent_id=JERI_AGENT_ID)
    detached_any = False
    for tool in (current.tools or []):
        if tool.name in SDK_DEV_TOOLS:
            try:
                client.agents.tools.detach(agent_id=JERI_AGENT_ID, tool_id=tool.id)
                print(f"   ✓ Detached: {tool.name}")
                detached_any = True
            except Exception as e:
                print(f"   ! Could not detach {tool.name}: {e}")
    if not detached_any:
        print("   (none found)")
    print()

    # 3. Register and attach the 3 utility tools
    print("3. Registering utility tools...")
    for func in [list_january_statements, read_statement_file, save_artifact]:
        print(f"   Registering {func.__name__}...")
        tool = client.tools.create_from_function(func=func)
        client.agents.tools.attach(agent_id=JERI_AGENT_ID, tool_id=tool.id)
        print(f"   ✓ {func.__name__} (id={tool.id})")
    print()

    # 4. Set tool environment variables
    print("4. Setting tool environment variables...")
    client.agents.update(
        agent_id=JERI_AGENT_ID,
        tool_exec_environment_variables={
            "JERI_ARTIFACT_ROOT": ARTIFACT_ROOT,
            "LETTA_BASE_URL": LETTA_SERVER,
        },
    )
    print("   ✓ Done.\n")

    # 5. Initialise memfs memory
    print("5. Initialising memfs memory files...")
    try:
        init_memfs(JERI_AGENT_ID, LETTA_SERVER, LETTA_API_KEY)
    except Exception as e:
        print(f"   ! memfs init failed: {e}")
        print("     Run manually: letta memfs pull  (then edit files in ~/.letta/agents/<id>/memory/)")
    print()

    # 6. Tag agent to auto-enable memfs on next startup
    print("6. Tagging agent with git-memory-enabled...")
    try:
        existing_tags = list(getattr(current, "tags", []) or [])
        if "git-memory-enabled" not in existing_tags:
            existing_tags.append("git-memory-enabled")
            client.agents.update(agent_id=JERI_AGENT_ID, tags=existing_tags)
            print("   ✓ Tag added.")
        else:
            print("   (already tagged)")
    except Exception as e:
        print(f"   ! Tagging failed: {e}")
        print("     Enable memfs manually: letta /memfs enable  (inside the letta-code CLI)")
    print()

    print("✅ Jeri is configured.")
    print("   Mazda agent IDs are hardcoded in every tool — no runtime lookup needed.")
    print("   Memory lives in memfs (git-backed). To inspect:")
    print("     letta memfs status  (from letta-code CLI with LETTA_AGENT_ID set)")
    print(f"   Test: send Jeri a message:")
    print('     "List the January statement files and tell me what you find."')


if __name__ == "__main__":
    main()
