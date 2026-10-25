import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  IDocumentRepository,
  IDocumentRef,
  IDocumentHandle,
} from '../interfaces/documents.js';
import type { IScopeGuard } from '../interfaces/policy.js';

class DocumentHandle implements IDocumentHandle {
  constructor(readonly ref: IDocumentRef) {}

  async readText(): Promise<string> {
    return fs.readFile(this.ref.path, 'utf-8');
  }

  async close(): Promise<void> {
    // no-op for file handles
  }
}

export class FileDocumentRepository implements IDocumentRepository {
  constructor(
    private readonly targetDir: string,
    private readonly scopeGuard: IScopeGuard,
  ) {}

  async list(): Promise<readonly IDocumentRef[]> {
    this.scopeGuard.ensurePathInScope(this.targetDir);
    let entries: string[];
    try {
      entries = await fs.readdir(this.targetDir);
    } catch {
      return [];
    }

    const refs: IDocumentRef[] = [];
    for (const entry of entries) {
      const fullPath = path.join(this.targetDir, entry);
      try {
        const stat = await fs.stat(fullPath);
        if (stat.isFile()) {
          refs.push({
            path: fullPath,
            bytes: stat.size,
            modifiedAt: stat.mtime,
            mimeType: this.guessMimeType(entry),
          });
        }
      } catch {
        // skip unreadable entries
      }
    }
    return refs;
  }

  async find(predicate: (d: IDocumentRef) => boolean): Promise<readonly IDocumentRef[]> {
    const all = await this.list();
    return all.filter(predicate);
  }

  async open(ref: IDocumentRef): Promise<IDocumentHandle> {
    this.scopeGuard.ensureInScope(ref);
    return new DocumentHandle(ref);
  }

  private guessMimeType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.txt') return 'text/plain';
    if (ext === '.csv') return 'text/csv';
    return 'application/octet-stream';
  }
}
