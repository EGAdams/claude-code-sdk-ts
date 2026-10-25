"""Letta tool definitions for jeri-agent.

Each function is registered as a Letta tool. Letta auto-generates JSON schemas
from Google-style docstrings. Tools that use `client` as a parameter get the
Letta client auto-injected at call time.
"""

import json
import os
import subprocess
import uuid
import requests

JERI_A2A_URL = os.environ.get("JERI_A2A_URL", "http://10.0.0.143:9001")
SDK_ROOT = os.environ.get("CLAUDE_CODE_SDK_ROOT", "/home/adamsl/claude-code-sdk-ts")
STATEMENTS_DIR = os.environ.get(
    "JANUARY_STATEMENTS_DIR",
    "/home/adamsl/rol_finances/readable_documents/bank_statements/january",
)


# ── SDK mastery tools ──────────────────────────────────────────────────────────


def read_sdk_file(file_path: str) -> str:
    """Read a file from the claude-code-sdk-ts repository.

    Args:
        file_path (str): Path relative to the SDK repo root, e.g. "src/fluent.ts".

    Returns:
        str: File contents, or an error message prefixed with "ERROR:".
    """
    full = os.path.join(SDK_ROOT, file_path)
    # Scope check: must be under SDK_ROOT
    if not os.path.realpath(full).startswith(os.path.realpath(SDK_ROOT)):
        return f"ERROR: Access denied — path outside SDK root: {file_path}"
    try:
        with open(full, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return f"ERROR: File not found: {file_path}"
    except Exception as e:
        return f"ERROR: {e}"


def list_sdk_dir(dir_path: str = "") -> str:
    """List files in a directory under the claude-code-sdk-ts repository.

    Args:
        dir_path (str): Path relative to the SDK repo root, e.g. "src" or "src/types".
                        Defaults to the repo root when empty.

    Returns:
        str: JSON list of file/directory names, or an error message.
    """
    full = os.path.join(SDK_ROOT, dir_path)
    if not os.path.realpath(full).startswith(os.path.realpath(SDK_ROOT)):
        return f"ERROR: Access denied: {dir_path}"
    try:
        entries = os.listdir(full)
        return json.dumps(sorted(entries))
    except Exception as e:
        return f"ERROR: {e}"


def run_typescript(script: str) -> str:
    """Run an npm script in the claude-code-sdk-ts repository.

    Args:
        script (str): One of: build, test, typecheck, lint, format, dev.

    Returns:
        str: Combined stdout and stderr output from the npm script.
    """
    allowed = {"build", "test", "typecheck", "lint", "format", "dev"}
    if script not in allowed:
        return f"ERROR: Script '{script}' is not allowed. Allowed: {', '.join(sorted(allowed))}"
    result = subprocess.run(
        ["npm", "run", script],
        cwd=SDK_ROOT,
        capture_output=True,
        text=True,
        timeout=120,
    )
    return (result.stdout + result.stderr).strip()


# ── Financial statement tools (delegate to Jeri A2A) ──────────────────────────


def _a2a_call(skill_id: str, message: str, context: dict | None = None) -> str:
    """Invoke a Jeri A2A skill and return the raw response text."""
    payload = {
        "jsonrpc": "2.0",
        "method": "SendMessage",
        "id": str(uuid.uuid4()),
        "params": {
            "message": {"role": "ROLE_USER", "parts": [{"text": message}]},
            "skill": skill_id,
            "context": context or {},
        },
    }
    try:
        r = requests.post(JERI_A2A_URL, json=payload, timeout=300)
        r.raise_for_status()
        data = r.json()
        result = data.get("result", {})
        task_id = result.get("id", "")
        # Poll for completion
        for _ in range(60):
            import time
            time.sleep(2)
            poll = requests.post(
                JERI_A2A_URL,
                json={"jsonrpc": "2.0", "method": "GetTask", "id": str(uuid.uuid4()), "params": {"id": task_id}},
                timeout=30,
            ).json()
            state = poll.get("result", {}).get("status", {}).get("state", "")
            if state == "COMPLETED":
                return poll.get("result", {}).get("result", "")
            if state in ("FAILED", "CANCELED"):
                return f"ERROR: Task {state} — {poll.get('result', {}).get('error', 'unknown')}"
        return "ERROR: Task polling timed out"
    except Exception as e:
        return f"ERROR: {e}"


def analyze_statement(statement_path: str) -> str:
    """Perform a deep structural analysis of a bank statement file.

    Args:
        statement_path (str): Absolute path to the bank statement file.

    Returns:
        str: JSON analysis with dates, totals, and merchant breakdown.
    """
    return _a2a_call(
        "analyze_statement",
        f"Analyze the bank statement at {statement_path}",
        {"statementPath": statement_path},
    )


def extract_transactions(statement_path: str) -> str:
    """Extract all transactions from a bank statement as structured JSON.

    Args:
        statement_path (str): Absolute path to the bank statement file.

    Returns:
        str: JSON array of transaction objects with date, description, and amount.
    """
    return _a2a_call(
        "extract_transactions",
        f"Extract all transactions from {statement_path}",
        {"statementPath": statement_path},
    )


def summarize_statement(statement_path: str) -> str:
    """Generate a natural language summary of a bank statement.

    Args:
        statement_path (str): Absolute path to the bank statement file.

    Returns:
        str: Natural language summary covering totals, top merchants, and flags.
    """
    return _a2a_call(
        "summarize_statement",
        f"Summarize the bank statement at {statement_path}",
        {"statementPath": statement_path},
    )


def prepare_report_snippet(statement_path: str) -> str:
    """Create a formatted Markdown report snippet from a bank statement.

    Args:
        statement_path (str): Absolute path to the bank statement file.

    Returns:
        str: Markdown-formatted report snippet suitable for rollup reports.
    """
    return _a2a_call(
        "prepare_report_snippet",
        f"Prepare a report snippet for {statement_path}",
        {"statementPath": statement_path},
    )


def find_anomalies(statement_path: str) -> str:
    """Detect unusual or suspicious transactions in a bank statement.

    Args:
        statement_path (str): Absolute path to the bank statement file.

    Returns:
        str: JSON array of anomaly objects with severity and recommended actions.
    """
    return _a2a_call(
        "find_anomalies",
        f"Find anomalies in the bank statement at {statement_path}",
        {"statementPath": statement_path},
    )


# ── Agent-to-agent communication tools ────────────────────────────────────────


def send_a2a_task(agent_url: str, skill_id: str, message: str) -> str:
    """Delegate a task to another A2A-compatible agent.

    Args:
        agent_url (str): Base URL of the target agent (e.g., "http://10.0.0.143:9002").
        skill_id (str): The skill ID to invoke on the target agent.
        message (str): Task description or payload to send.

    Returns:
        str: JSON-serialized task result from the remote agent.
    """
    payload = {
        "jsonrpc": "2.0",
        "method": "SendMessage",
        "id": str(uuid.uuid4()),
        "params": {
            "message": {"role": "ROLE_USER", "parts": [{"text": message}]},
            "skill": skill_id,
        },
    }
    try:
        r = requests.post(agent_url, json=payload, timeout=120)
        r.raise_for_status()
        return r.text
    except Exception as e:
        return f"ERROR: {e}"


def send_letta_message(agent_id: str, message: str) -> str:
    """Send a message to another Letta agent on the same server.

    Args:
        agent_id (str): The Letta agent ID of the target agent.
        message (str): The message content to send.

    Returns:
        str: The agent's reply as a string.
    """
    from letta_client import Letta as _Letta
    base_url = os.environ.get("LETTA_BASE_URL", "http://100.80.49.10:8283")
    try:
        letta = _Letta(base_url=base_url)
        result = letta.agents.messages.create(
            agent_id=agent_id,
            messages=[{"role": "user", "content": message}],
        )
        return str(result)
    except Exception as e:
        return f"ERROR: {e}"
