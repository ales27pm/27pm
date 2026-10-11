export interface SamplingDefinition { id: string; sector: string }
export interface Candidate { source_id: string; sector: string; region: string; url: string; host: string; source_record_id: string }
export function parseSemicolonCsv(source: string): Array<Record<string, string>>;
export function canonicalHost(hostname: string): string;
export function isExcludedHost(hostname: string): boolean;
export function normalizeHomepage(rawValue: unknown): { url: string; host: string } | null;
export function candidatesFromCsv(source: string, definition: SamplingDefinition): { row_count: number; ambiguous_host_count: number; funnel: { input_record_count: number; record_exclusions: Record<string, number>; host_stage: Record<string, number> }; candidates: Candidate[] };
export function selectRegionBalanced(sources: Array<{ id: string; candidates: Candidate[] }>, options: { perSource?: number; cellCap?: number; seed: string }): {
  sites: Array<{ site_id: string; url: string; region: string; sector: string; source_id: string; eligibility: 'included' }>;
  source_stats: Array<{ source_id: string; candidate_host_count: number; cross_source_host_count: number; selected_count: number; selected_region_count: number }>;
  region_stats: Array<{ region: string; raw_candidate_count: number; flow_capacity: number; quota: number; selected_count: number }>;
};
