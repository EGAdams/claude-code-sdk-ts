import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { IArtifactStore, IArtifactRef } from '../interfaces/documents.js';
import type { IScopeGuard } from '../interfaces/policy.js';

export class FileArtifactStore implements IArtifactStore {
  constructor(
    private readonly rootDir: string,
    private readonly scopeGuard: IScopeGuard,
  ) {}

  async put(kind: IArtifactRef['kind'], content: string | Uint8Array): Promise<IArtifactRef> {
    const id = uuidv4();
    const ext = kind === 'transactions-csv' ? '.csv' : '.md';
    const filename = `${kind}-${id}${ext}`;
    const artifactPath = path.join(this.rootDir, filename);

    this.scopeGuard.ensurePathInScope(artifactPath);
    await fs.mkdir(this.rootDir, { recursive: true });

    if (typeof content === 'string') {
      await fs.writeFile(artifactPath, content, 'utf-8');
    } else {
      await fs.writeFile(artifactPath, content);
    }

    return { id, path: artifactPath, kind, createdAt: new Date() };
  }

  async get(id: string): Promise<{ ref: IArtifactRef; content: Uint8Array }> {
    const entries = await fs.readdir(this.rootDir);
    const match = entries.find(e => e.includes(id));
    if (!match) throw new Error(`Artifact not found: ${id}`);

    const artifactPath = path.join(this.rootDir, match);
    const content = await fs.readFile(artifactPath);
    const kind = this.kindFromFilename(match);

    return {
      ref: { id, path: artifactPath, kind, createdAt: new Date() },
      content,
    };
  }

  private kindFromFilename(filename: string): IArtifactRef['kind'] {
    if (filename.startsWith('summary')) return 'summary';
    if (filename.startsWith('report-snippet')) return 'report-snippet';
    if (filename.startsWith('transactions-csv')) return 'transactions-csv';
    if (filename.startsWith('anomaly-report')) return 'anomaly-report';
    return 'summary';
  }
}
