import type { IUsageReport } from './claude.js';

export interface ITelemetryEvent {
  readonly name: string;
  readonly timestamp: Date;
  readonly correlationId?: string;
  readonly attributes: Readonly<Record<string, unknown>>;
}

export interface ITelemetrySink {
  emit(event: ITelemetryEvent): void;
}

export interface IUsageReporter {
  report(capability: string, usage: IUsageReport, correlationId: string): void;
}

export interface IMetricsCollector {
  counter(name: string, value?: number, tags?: Record<string, string>): void;
  histogram(name: string, value: number, tags?: Record<string, string>): void;
  gauge(name: string, value: number, tags?: Record<string, string>): void;
}

export interface IClock {
  now(): Date;
  monotonicMs(): number;
}
