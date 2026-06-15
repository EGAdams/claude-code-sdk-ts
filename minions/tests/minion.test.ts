import { describe, expect, it } from 'vitest';
import { DefaultMinion } from '../src/minion.js';
import type {
  IClaudeAgentSdkRunner,
  IMinionTaskRequest,
  IMinionTaskResult
} from '../src/interfaces/minion.js';

class FakeRunner implements IClaudeAgentSdkRunner {
  public lastRequest: IMinionTaskRequest | undefined;

  constructor(private readonly result: IMinionTaskResult) {}

  async run(request: IMinionTaskRequest): Promise<IMinionTaskResult> {
    this.lastRequest = request;
    return this.result;
  }
}

describe('DefaultMinion', () => {
  it('delegates a matching-role task to the runner and returns its result', async () => {
    const runner = new FakeRunner({ status: 'ok', output: 'done' });
    const minion = new DefaultMinion('parser', runner);

    const request: IMinionTaskRequest = {
      taskId: 'task-1',
      role: 'parser',
      description: 'extract transactions from statement.pdf'
    };

    const result = await minion.handle(request);

    expect(result).toEqual({ status: 'ok', output: 'done' });
    expect(runner.lastRequest).toEqual(request);
  });

  it('rejects a task envelope addressed to a different role', async () => {
    const runner = new FakeRunner({ status: 'ok', output: 'done' });
    const minion = new DefaultMinion('parser', runner);

    const request: IMinionTaskRequest = {
      taskId: 'task-2',
      role: 'router',
      description: 'classify this document'
    };

    const result = await minion.handle(request);

    expect(result.status).toBe('error');
    expect(result.error).toMatch(/role/i);
    expect(runner.lastRequest).toBeUndefined();
  });
});
