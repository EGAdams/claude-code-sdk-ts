export interface ISessionId {
  readonly value: string;
  readonly issuedAt: Date;
}

export interface ISessionStore {
  get(key: string): Promise<ISessionId | undefined>;
  put(key: string, id: ISessionId): Promise<void>;
  drop(key: string): Promise<void>;
}

export interface ISessionKeyStrategy {
  keyFor(correlationId: string, capability: string): string;
}

export interface ISessionFactory {
  open(key: string): Promise<ISessionId>;
  resume(key: string): Promise<ISessionId | undefined>;
}
