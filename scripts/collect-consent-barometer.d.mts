import type { Browser, BrowserContext, Page } from 'playwright';
import type { AggregateRow } from './lib/consent-barometer.mjs';

export interface SiteEntry {
  site_id: string;
  url: string;
  eligibility: 'included' | 'excluded';
  region?: string;
  sector?: string;
  exclusion_reason?: string;
}

export interface BannerResult {
  detected: boolean;
  rejectCount: number;
  dialogRole?: boolean;
  dialogHasName?: boolean | null;
  privacyLink?: boolean;
  overflowPx?: number;
  axeSelector?: string | { fromShadowDom: [string, string, ...string[]] };
  bannerSelector?: string;
}

export interface KeyboardResult {
  steps: number | null;
  focusIndicatorHeuristic: boolean | null;
  activated: boolean;
  actionResult: 'closed' | 'failed' | 'navigated' | 'indeterminate';
  errors: string[];
}

export interface Observation {
  site_id: string;
  eligibility: string;
  http_responded?: boolean;
  analyzable?: boolean;
  analysis_reason?: string | null;
  final_status?: number | null;
  user_agent?: string | null;
  touch_points?: number | null;
  banner_detected?: string;
  reject_first_layer?: string;
  keyboard_reject_steps?: number | null;
  dialog_role_present?: boolean | null;
  dialog_accessible_name?: string;
  focus_indicator_heuristic?: string;
  axe_rule_count_banner?: number | null;
  reject_action_closed?: string;
  cookies_before_choice_count?: number | null;
  document_storage_keys_before_choice_count?: number | null;
  cookies_after_reject_count?: number | null;
  document_storage_keys_after_reject_count?: number | null;
  errors: string[];
  [key: string]: unknown;
}

export interface CollectorDependencies {
  initialWaitMs?: number;
  afterActionDelayMs?: number;
  contextOptions?: Record<string, unknown>;
  readStorageCounts?: (page: Page, context: BrowserContext) => Promise<{ cookies: number | null; storage: number | null; errors: string[] }>;
  detectBanner?: (page: Page, options?: { mark?: boolean }) => Promise<BannerResult>;
  rejectByKeyboard?: (page: Page, options: { detectBannerAfterAction: (page: Page, options?: { mark?: boolean }) => Promise<BannerResult>; afterActionDelayMs: number; bannerSelector?: string; onBeforeActivation: () => void | Promise<void> }) => Promise<KeyboardResult>;
  analyzeBanner?: (page: Page, banner: BannerResult) => Promise<{ violations: Array<{ id: string }> }>;
  recordPrivateEvidence?: (entry: Record<string, unknown>) => void;
  detectChallenge?: (page: Page) => Promise<boolean>;
}

export function storageCounts(page: Page, context: BrowserContext): Promise<{ cookies: number | null; storage: number | null; errors: string[] }>;
export function findBanner(page: Page, options?: { mark?: boolean }): Promise<BannerResult>;
export function keyboardReject(page: Page, options?: { detectBannerAfterAction?: (page: Page, options?: { mark?: boolean }) => Promise<BannerResult>; afterActionDelayMs?: number; bannerSelector?: string; onBeforeActivation?: () => void | Promise<void> }): Promise<KeyboardResult>;
export function detectChallenge(page: Page): Promise<boolean>;
export function isExternalHost(candidate: string, finalUrl: string): boolean;
export function classifyStablePage(input: { initialUrl: string; finalUrl: string; status: number | null; contentType: string | null; challengeDetected?: boolean }): { analyzable: boolean; reason: string | null };
export function parseCollectorArgs(argv: string[]): { validateOnly: boolean; limit: number | null; siteId: string | null; manifest?: string; out?: string; help?: boolean };
export function collectSite(browser: Browser, site: SiteEntry, dependencies?: CollectorDependencies): Promise<Observation>;
export function writeCollectorOutputs(input: {
  outDir: string;
  study: Record<string, unknown>;
  observations: Observation[];
  aggregates: AggregateRow[];
  navigationLedger: Array<Record<string, unknown>>;
  privateRun: Record<string, unknown>;
}): Promise<void>;
