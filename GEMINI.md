# Claude Code SDK for TypeScript - Project Context

## Project Overview
An unofficial TypeScript port of the official Python Claude Code SDK. This project provides a programmatic wrapper around the Anthropic Claude Code CLI tool, allowing developers to interact with Claude Code directly from TypeScript/Node.js applications.

### Core Architecture
- **Transport Layer**: `SubprocessCLITransport` (`src/_internal/transport/subprocess-cli.ts`) manages communication with the `claude` CLI via `stdin` (for prompts) and `stdout` (parsing NDJSON output).
- **API Layers**:
  - **Fluent API** (Recommended): `claude()` factory returning a `QueryBuilder` for chainable configurations.
  - **Classic API**: `query()` async generator function yielding message objects.
- **Proxy Server**: `proxy-server.ts` provides an OpenAI-compatible API layer, allowing tools like Letta to use this SDK as a backend.
- **Key Modules**:
  - `config/`: Configuration loading (JSON/YAML) with inheritance.
  - `roles/`: Persona/Role management with template variables.
  - `permissions/`: Tool and MCP server permission management.
  - `retry/`: Backoff and retry strategies (Exponential, Linear, Fibonacci).
  - `streaming/`: Token-level streaming for visual effects.
  - `telemetry/`: Pluggable metrics for usage, cost, and errors.
  - `errors/`: Enhanced error classification and resolution hints.

### Main Technologies
- **Runtime**: Node.js (>= 18.0.0)
- **Language**: TypeScript (Strict mode enabled)
- **Subprocess**: `execa`
- **Build Tool**: `tsup` (outputs both ESM and CJS)
- **Test Runner**: `vitest`
- **Linting/Formatting**: `eslint`, `prettier`
- **Integrations**: Letta (via `proxy-server.ts` and `create-letta-agent.py`)

## Building and Running

### Installation
```bash
npm install
```

### Key Commands
- **Build**: `npm run build` (Outputs to `dist/`)
- **Development**: `npm run dev` (Watch mode)
- **Testing**: `npm test` (Runs Vitest)
- **Type Checking**: `npm run typecheck` (`tsc --noEmit`)
- **Linting**: `npm run lint`
- **Formatting**: `npm run format`
- **Proxy Server**: `npm run proxy` (Starts `proxy-server.ts` on port 4000)
- **Letta Integration**: `python create-letta-agent.py` (Requires proxy and Letta server)

## Development Conventions

### Coding Style
- **Strict TypeScript**: Adhere to strict typing; avoid `any`.
- **Naming**: Use lowercase kebab-case for filenames (e.g., `subprocess-cli.ts`).
- **File Structure**:
  - Public API is exported from `src/index.ts`.
  - Implementation details live in `src/_internal/`.
  - Type definitions are modularized in `src/types/`.
- **Imports**: Use explicit `.js` extensions in imports for ESM compatibility (as seen in `src/index.ts`).

### Testing Practices
- Tests should be located in `src/` with a `.test.ts` suffix or in a dedicated `tests/` directory (though currently none are present, `vitest.config.ts` looks for `**/*.test.ts`).
- Use Vitest's `describe`/`it` or `test` blocks.

### Dependencies and Libraries
- **Subprocesses**: Always use `execa` for CLI interactions.
- **Config Parsing**: Use `js-yaml` for YAML files.
- **CLI Discovery**: Use `which` to locate the `claude` executable.

## Usage Patterns

### Basic Query
```typescript
import { claude } from '@instantlyeasy/claude-code-sdk-ts';

const text = await claude()
  .query('Tell me a joke')
  .asText();
```

### Tool Permissions
```typescript
await claude()
  .allowTools('Read', 'LS')
  .denyTools('Bash')
  .query('Analyze the current directory')
  .asText();
```

### Error Handling
```typescript
import { isEnhancedError } from '@instantlyeasy/claude-code-sdk-ts';

try {
  await claude().query('...').asText();
} catch (error) {
  if (isEnhancedError(error)) {
    console.log(error.category, error.resolution);
  }
}
```
