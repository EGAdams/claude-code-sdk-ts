import * as path from 'node:path';
import { ClaudeSdkQueryFactory } from './adapters/claude-sdk-query-factory.js';
import { CapabilityRegistry } from './adapters/capability-registry.js';
import { ScopeGuard } from './adapters/scope-guard.js';
import { FileArtifactStore } from './adapters/artifact-store.js';
import { StubMessengerClient } from './adapters/messenger-client.js';
import { AnalyzeStatementCapability } from './capabilities/analyze-statement.js';
import { ExtractTransactionsCapability } from './capabilities/extract-transactions.js';
import { SummarizeStatementCapability } from './capabilities/summarize-statement.js';
import { PrepareReportSnippetCapability } from './capabilities/prepare-report-snippet.js';
import { FindAnomaliesCapability } from './capabilities/find-anomalies.js';
import type { ICapabilityRegistry } from './interfaces/capabilities.js';
import type { IMessengerClient } from './interfaces/a2a.js';

const SDK_ROOT = process.env['CLAUDE_CODE_SDK_ROOT'] ?? '/home/adamsl/claude-code-sdk-ts';
const STATEMENTS_DIR = process.env['JANUARY_STATEMENTS_DIR'] ?? '/home/adamsl/rol_finances/readable_documents/bank_statements/january';
const ARTIFACT_ROOT = process.env['JERI_ARTIFACT_ROOT'] ?? path.join(process.env['HOME'] ?? '/home/adamsl', 'jeri_artifacts');

export interface JeriContainer {
  registry: ICapabilityRegistry;
  messenger: IMessengerClient;
}

export function buildContainer(): JeriContainer {
  const scopeGuard = new ScopeGuard([SDK_ROOT, STATEMENTS_DIR]).withOverride([ARTIFACT_ROOT]);
  const factory = new ClaudeSdkQueryFactory();
  const artifactStore = new FileArtifactStore(ARTIFACT_ROOT, scopeGuard);

  const registry = new CapabilityRegistry();
  registry.register(new AnalyzeStatementCapability(factory, scopeGuard));
  registry.register(new ExtractTransactionsCapability(factory, scopeGuard));
  registry.register(new SummarizeStatementCapability(factory, scopeGuard));
  registry.register(new PrepareReportSnippetCapability(factory, scopeGuard, artifactStore));
  registry.register(new FindAnomaliesCapability(factory, scopeGuard));

  const messenger = new StubMessengerClient();

  return { registry, messenger };
}
