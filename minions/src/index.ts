export * from './interfaces/minion.js';
export { DefaultMinion } from './minion.js';
export { ClaudeAgentSdkRunner } from './implementations/claudeAgentSdkRunner.js';
export type { ClaudeAgentSdkRunnerOptions } from './implementations/claudeAgentSdkRunner.js';

import { DefaultMinion } from './minion.js';
import { ClaudeAgentSdkRunner, type ClaudeAgentSdkRunnerOptions } from './implementations/claudeAgentSdkRunner.js';
import type { IMinion, MinionRole } from './interfaces/minion.js';

/** Construct a minion for `role`, wired to a real Claude Agent SDK runner. */
export function createMinion(role: MinionRole, options?: ClaudeAgentSdkRunnerOptions): IMinion {
  return new DefaultMinion(role, new ClaudeAgentSdkRunner(options));
}
