import * as path from 'node:path';
import * as fs from 'node:fs';
import type { IScopeGuard, IPathPolicy } from '../interfaces/policy.js';
import type { IDocumentRef } from '../interfaces/documents.js';

export class ScopeViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScopeViolationError';
  }
}

class PathPolicy implements IPathPolicy {
  constructor(private readonly allowedRoots: readonly string[]) {}

  isAllowed(absPath: string): boolean {
    const resolved = this.resolve(absPath);
    return this.allowedRoots.some(root => resolved.startsWith(root + path.sep) || resolved === root);
  }

  explain(absPath: string): string {
    return `Path "${absPath}" is outside allowed roots: ${this.allowedRoots.join(', ')}`;
  }

  private resolve(p: string): string {
    try {
      return fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  }
}

export class ScopeGuard implements IScopeGuard {
  private readonly policy: IPathPolicy;

  constructor(allowedRoots: readonly string[]) {
    const resolved = allowedRoots.map(r => {
      try {
        return fs.realpathSync(r);
      } catch {
        return path.resolve(r);
      }
    });
    this.policy = new PathPolicy(resolved);
  }

  ensureInScope(ref: IDocumentRef): void {
    this.ensurePathInScope(ref.path);
  }

  ensurePathInScope(absPath: string): void {
    if (!this.policy.isAllowed(absPath)) {
      throw new ScopeViolationError(this.policy.explain(absPath));
    }
  }

  withOverride(allowed: readonly string[]): IScopeGuard {
    const currentRoots = (this.policy as PathPolicy)['allowedRoots'] as string[];
    return new ScopeGuard([...currentRoots, ...allowed]);
  }
}
