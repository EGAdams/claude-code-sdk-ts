# Multi-Agent Design Ideas for claude-code-sdk-ts

## 1. Parallel Agent Orchestration

Run multiple Claude agents concurrently, each with a focused responsibility, then combine results.

```typescript
// Agent A researches, Agent B writes code, Agent C reviews
const [research, code] = await Promise.all([
  claude().ask("Research the best approach for X"),
  claude().ask("Write an initial implementation for X"),
]);

const review = await claude().ask(
  `Review this implementation:\n${await code.asText()}\n\nContext:\n${await research.asText()}`
);

console.log(await review.asText());
```

**Use cases:**
- Code generation + review pipelines
- Research + summarize + write workflows
- Parallel data processing with different prompts

---

## 2. Custom Roles as Agent Personas

Use the SDK's `roles/` module to define reusable agent personas with inheritance and template variables.

```typescript
// roles/reviewer.yaml
// roles/researcher.yaml (extends reviewer)
const result = await claude()
  .withRole("senior-engineer")
  .ask("Review this PR diff: {{diff}}");
```

**Use cases:**
- Consistent agent personalities across pipelines
- Role inheritance (junior → senior → architect)
- Template variables for dynamic context injection

---

## 3. Resilient Retry Pipelines

Wrap agentic calls with the `retry/` module to handle transient failures gracefully.

```typescript
import { RetryExecutor } from "./src/retry";

const executor = new RetryExecutor({
  strategy: "exponential",
  maxAttempts: 3,
  baseDelay: 1000,
});

const result = await executor.run(() =>
  claude().withModel("claude-opus-4-6").ask("Generate a full test suite for X")
);
```

**Use cases:**
- Long-running agentic tasks that may hit rate limits
- Pipelines where one agent's failure shouldn't kill the whole chain
- Production workloads requiring SLA guarantees

---

## 4. Observed Pipelines with Telemetry

Use the `telemetry/` module to instrument multi-agent pipelines — track execution time, token usage, and errors across every agent call.

```typescript
import { TelemetryProvider } from "./src/telemetry";

const telemetry = new TelemetryProvider({
  onMetric: (metric) => console.log(metric),
});

const result = await claude()
  .withTelemetry(telemetry)
  .ask("Summarize this document");
```

**Use cases:**
- Cost tracking across complex pipelines
- Latency profiling per agent role
- Error rate monitoring in production

---

## 5. Permission-Scoped Agents

Use the `permissions/` module to give each agent in a pipeline only the tools it needs — least-privilege agent design.

```typescript
const researchAgent = claude()
  .withPermissions({ allowedTools: ["web_search", "read_file"] })
  .ask("Research topic X");

const writeAgent = claude()
  .withPermissions({ allowedTools: ["write_file"] })
  .ask("Write a report on X");
```

**Use cases:**
- Security-sensitive pipelines where agents shouldn't have broad tool access
- MCP server integration with per-agent permission scopes
- Auditable agentic systems

---

## 6. Streaming Multi-Agent Pipelines

Use the `streaming/` module to pipe token-level output from one agent into another in near-real-time.

```typescript
// Stream results from one agent as input to the next
const stream = claude()
  .withStreaming({ pauseOnToken: false })
  .ask("Generate a long document about X");

// Process chunks as they arrive
for await (const chunk of stream) {
  // Feed chunks to a second agent, display progress, etc.
}
```

**Use cases:**
- Real-time UI updates during long agentic tasks
- Early-termination if the first agent goes off-track
- Incremental processing without waiting for full responses

---

## Next Steps

- [ ] Pick one pattern to prototype first
- [ ] Decide if orchestration logic lives in `src/` or in examples
- [ ] Consider a high-level `Pipeline` class or builder that chains agents
- [ ] Add telemetry + retry as default wrappers in an `AgentPipeline` utility
