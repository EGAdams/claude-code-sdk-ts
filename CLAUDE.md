# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Unofficial TypeScript port of the official Python Claude Code SDK. A wrapper around the Claude Code CLI that provides programmatic access via subprocess communication (NDJSON over stdin/stdout). Requires Node.js 18+.

**Runtime prerequisite:** the Claude Code CLI must be installed globally (`npm install -g @anthropic-ai/claude-code`) — the SDK spawns it. Authentication is delegated entirely to the CLI (`claude login`); the SDK never handles auth directly. `ANTHROPIC_API_KEY` is intentionally NOT auto-loaded from env to prevent accidental billing.

## Commands

- `npm run build` — Build with tsup (outputs CJS + ESM to `dist/`)
- `npm run dev` — Watch mode build
- `npm test` — Run tests with Vitest
- `npm run test:coverage` — Tests with coverage
- `npm run typecheck` — Type check without emitting (`tsc --noEmit`)
- `npm run lint` — ESLint on `src/`
- `npm run format` — Prettier on `src/`
- `npm run proxy` — Run `proxy-server.ts` via tsx; unsets `CLAUDECODE` and `CLAUDE_CODE_ENTRYPOINT` first so the proxy doesn't inherit a parent CLI's env

Run a single test file: `npx vitest run path/to/file.test.ts`

**No tests exist in `src/` yet** — Vitest is configured but the suite is empty. New tests should be colocated as `*.test.ts` next to the source they cover.

## Architecture

**Two API layers:**
1. **Classic API** — `query()` async generator that yields `Message` objects
2. **Fluent API** — `claude()` factory returns a `QueryBuilder` (chainable config) that resolves to a `ResponseParser` (extraction methods like `.asText()`, `.asJSON()`, `.asToolExecutions()`)

**Transport:** `SubprocessCLITransport` (`src/_internal/transport/subprocess-cli.ts`) spawns the Claude CLI as a child process, sends options as CLI args, and reads NDJSON output line-by-line.

**Key data flow:** `claude().withModel(...).ask(prompt)` → `QueryBuilder` builds options → `InternalClient.processQuery()` → `SubprocessCLITransport.connect()` → spawns CLI → yields parsed `Message` objects → `ResponseParser` wraps results.

**Feature modules** (each self-contained with types):
- `config/` — YAML/JSON config file loading with inheritance
- `roles/` — Role definitions with inheritance and template variables
- `permissions/` — MCP server permissions + per-call tool permissions
- `streaming/` — Token-level streaming with pause/resume
- `retry/` — Retry executor with exponential/linear/fibonacci backoff
- `telemetry/` — Pluggable metrics (execution time, tokens, errors)
- `errors/` — Error detection, classification, and resolution hints

**Internal vs public:** `src/_internal/` contains implementation details not re-exported. Public API surface is defined in `src/index.ts`. `src/enhanced/index.ts` is a secondary export grouping retry / streaming / error helpers used by the v0.3.x "enhanced" examples.

## Key Conventions

- **Strict TypeScript** — `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noUncheckedIndexedAccess` all enabled
- **File naming:** lowercase with hyphens (`subprocess-cli.ts`)
- **Types** live in `src/types/` as separate files per domain
- **Dual format build:** tsup produces both CJS and ESM from single `src/index.ts` entry
- **Dependencies:** `execa` (subprocess), `js-yaml` (config parsing), `which` (CLI discovery)
