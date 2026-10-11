export interface MetricDefinition {
  id: string;
  label: string;
  type: 'categorical' | 'number';
  unit: string;
  collection_method: 'automated' | 'manual';
  denominator_rule: string;
  interpretation_limit: string;
  reference_url: string;
}

export interface AggregateRow {
  metric_id: string;
  denominator_n: number;
  measured_n: number;
  missing_n: number;
  count: number | null;
  pct: number | null;
  median: number | null;
  p25: number | null;
  p75: number | null;
  min: number | null;
  max: number | null;
}

export const SCHEMA_VERSION: string;
export const COLLECTOR_VERSION: string;
export const MIN_PUBLIC_BREAKDOWN_N: number;
export const PUBLIC_METRIC_IDS: readonly string[];
export const PUBLICATION_RULE: string;
export const METRIC_DEFINITIONS: MetricDefinition[];
export function sha256(value: string): string;
export function stableJson(value: unknown): string;
export function publicStudyMetadata<T extends Record<string, unknown>>(study: T): Omit<T, 'selection_seed'>;
export function publicMetricResults(metricDefinitions: MetricDefinition[], aggregates: AggregateRow[]): { metric_definitions: MetricDefinition[]; aggregates: AggregateRow[] };
export function validateHomepageUrl(value: string, label?: string): URL;
export function resolvePrivateArtifactsPath(value: string, label?: string, root?: string): string;
export function preparePrivateArtifactsPath(value: string, options?: { kind?: 'directory' | 'file'; label?: string; root?: string }): Promise<string>;
export function validateManifest<T>(manifest: T): T;
export function isAnalyzableStatus(status: unknown): boolean;
export function aggregateObservations(observations: Array<Record<string, unknown>>, metricDefinitions?: MetricDefinition[]): AggregateRow[];
export function aggregatesToCsv(aggregates: Array<Record<string, unknown>>): string;
export function observationsToCsv(observations: Array<Record<string, unknown>>): string;
