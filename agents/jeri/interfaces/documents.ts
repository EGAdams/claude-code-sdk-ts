export interface IDocumentRef {
  readonly path: string;
  readonly bytes: number;
  readonly modifiedAt: Date;
  readonly mimeType?: string;
}

export interface IArtifactRef {
  readonly id: string;
  readonly path: string;
  readonly kind: 'summary' | 'report-snippet' | 'transactions-csv' | 'anomaly-report';
  readonly createdAt: Date;
}

export interface IDocumentRepository {
  list(): Promise<readonly IDocumentRef[]>;
  find(predicate: (d: IDocumentRef) => boolean): Promise<readonly IDocumentRef[]>;
  open(ref: IDocumentRef): Promise<IDocumentHandle>;
}

export interface IDocumentHandle {
  readonly ref: IDocumentRef;
  readText(): Promise<string>;
  close(): Promise<void>;
}

export interface IDocumentParser {
  parse(handle: IDocumentHandle): Promise<IParsedStatement>;
}

export interface IParsedStatement {
  readonly accountId?: string;
  readonly periodStart?: Date;
  readonly periodEnd?: Date;
  readonly openingBalance?: number;
  readonly closingBalance?: number;
  readonly transactions: readonly ITransaction[];
  readonly unparsedRegions: readonly string[];
}

export interface ITransaction {
  readonly date: Date;
  readonly description: string;
  readonly amount: number;
  readonly balanceAfter?: number;
  readonly category?: string;
}

export interface ITransactionExtractor {
  extract(handle: IDocumentHandle): Promise<readonly ITransaction[]>;
}

export interface IStatementSummarizer {
  summarize(parsed: IParsedStatement): Promise<string>;
}

export interface IAnomalyDetector {
  detect(parsed: IParsedStatement): Promise<readonly IAnomaly[]>;
}

export interface IAnomaly {
  readonly kind: 'duplicate' | 'large-debit' | 'category-drift' | 'unparseable' | 'other';
  readonly evidence: string;
  readonly transaction?: ITransaction;
  readonly severity: 'info' | 'warn' | 'error';
}

export interface IReportSnippetBuilder {
  build(parsed: IParsedStatement, anomalies: readonly IAnomaly[]): Promise<string>;
}

export interface IArtifactStore {
  put(kind: IArtifactRef['kind'], content: string | Uint8Array): Promise<IArtifactRef>;
  get(id: string): Promise<{ ref: IArtifactRef; content: Uint8Array }>;
}
