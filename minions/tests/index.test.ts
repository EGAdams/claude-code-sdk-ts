import { describe, expect, it } from 'vitest';
import { createMinion, DefaultMinion } from '../src/index.js';

describe('createMinion', () => {
  it('wires a DefaultMinion to a real ClaudeAgentSdkRunner for the given role', () => {
    const minion = createMinion('categorization');

    expect(minion).toBeInstanceOf(DefaultMinion);
    expect(minion.role).toBe('categorization');
  });
});
