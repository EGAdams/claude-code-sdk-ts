import { describe, expect, it } from 'vitest';
import { ClaudeAgentSdkRunner } from '../src/implementations/claudeAgentSdkRunner.js';
import type { IMinionTaskRequest } from '../src/interfaces/minion.js';

describe('ClaudeAgentSdkRunner', () => {
  it(
    'runs a trivial task through a real Claude Agent SDK session',
    async () => {
      const runner = new ClaudeAgentSdkRunner({ timeoutMs: 120_000 });

      const request: IMinionTaskRequest = {
        taskId: 'task-smoke-1',
        role: 'router',
        description:
          'Reply with exactly this text and nothing else: MINION_RUNNER_OK',
        allowedTools: []
      };

      const result = await runner.run(request);

      expect(result.status).toBe('ok');
      expect(result.output).toContain('MINION_RUNNER_OK');
    },
    150_000
  );
});
