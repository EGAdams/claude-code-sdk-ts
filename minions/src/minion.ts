import type {
  IClaudeAgentSdkRunner,
  IMinion,
  IMinionTaskRequest,
  IMinionTaskResult,
  MinionRole
} from './interfaces/minion.js';

/**
 * Default `IMinion`: validates the task envelope is addressed to this
 * minion's role, then delegates to the injected `IClaudeAgentSdkRunner`.
 */
export class DefaultMinion implements IMinion {
  constructor(
    public readonly role: MinionRole,
    private readonly runner: IClaudeAgentSdkRunner
  ) {}

  async handle(request: IMinionTaskRequest): Promise<IMinionTaskResult> {
    if (request.role !== this.role) {
      return {
        status: 'error',
        output: '',
        error: `task addressed to role "${request.role}" but this minion handles "${this.role}"`
      };
    }

    return this.runner.run(request);
  }
}
