import { describe, expect, it } from 'vitest';
import { access, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  aggregateObservations,
  aggregatesToCsv,
  METRIC_DEFINITIONS,
  observationsToCsv,
  publicMetricResults,
  PUBLICATION_RULE,
  publicStudyMetadata,
  preparePrivateArtifactsPath,
  resolvePrivateArtifactsPath,
  sha256,
  stableJson,
  validateHomepageUrl,
  validateManifest,
} from '../scripts/lib/consent-barometer.mjs';
import { parseCollectorArgs, writeCollectorOutputs } from '../scripts/collect-consent-barometer.mjs';

const manifest = {
  schema_version: '0.1.0',
  study: {
    id: 'pilot-2026',
    resource_version: '0.1.0',
    title: 'Pilote',
    language: 'fr-CA',
    scope: 'Page d’accueil publique.',
    author: 'Alexis Boulet',
    publisher: '27PM',
    citation: 'Boulet, Alexis. « Pilote ». 27PM, 2026.',
    sampling_frame: [{ source_url: 'https://example.org/repertoire', retrieved_at: '2026-10-09' }],
    selection_rule: 'Première entrée admissible après tri stable.',
  },
  sites: [{ site_id: 'site-001', url: 'https://example.com/', eligibility: 'included' }],
};

describe('consent barometer contract', () => {
  it('supports a validated pseudonymous targeted recheck without combining it with a limit', () => {
    expect(parseCollectorArgs(['--manifest', 'sample.json', '--out', 'results', '--site-id', 'site-001']).siteId).toBe('site-001');
    expect(() => parseCollectorArgs(['--manifest', 'sample.json', '--out', 'results', '--site-id', 'https://private.example/'])).toThrow(/identifiant pseudonyme/);
    expect(() => parseCollectorArgs(['--manifest', 'sample.json', '--out', 'results', '--site-id', 'site-001', '--limit', '1'])).toThrow(/mutuellement exclusifs/);
  });
  it('keeps all private outputs beneath the ignored artifacts root', () => {
    expect(resolvePrivateArtifactsPath('artifacts/barometre-consentement/pilote-5')).toMatch(/artifacts\/barometre-consentement\/pilote-5$/);
    expect(() => resolvePrivateArtifactsPath('artifacts/barometre-consentement')).toThrow(/enfant/);
    expect(() => resolvePrivateArtifactsPath('public/ressources/barometre')).toThrow(/artifacts\/barometre-consentement/);
  });
  it('rejects symlink escapes and accepts only a fresh direct private child', async () => {
    const directory = await mkdtemp(join(await realpath(tmpdir()), 'barometer-private-root-'));
    const root = join(directory, 'artifacts', 'barometre-consentement');
    const outside = join(directory, 'outside');
    await mkdir(root, { recursive: true, mode: 0o700 });
    await mkdir(outside, { mode: 0o700 });
    await symlink(outside, join(root, 'escaped'), 'dir');
    await expect(preparePrivateArtifactsPath(join(root, 'escaped'), { root, kind: 'directory' })).rejects.toThrow(/inédit|exister/);

    const linkedRoot = join(directory, 'linked-root');
    await symlink(outside, linkedRoot, 'dir');
    await expect(preparePrivateArtifactsPath(join(linkedRoot, 'pilot'), { root: linkedRoot, kind: 'directory' })).rejects.toThrow(/racine privée/);

    const safe = await preparePrivateArtifactsPath(join(root, 'pilot'), { root, kind: 'directory' });
    expect(safe).toBe(join(root, 'pilot'));
    if (process.platform !== 'win32') expect((await stat(safe)).mode & 0o777).toBe(0o700);
    await rm(directory, { recursive: true, force: true });
  });
  it('accepts a minimal deterministic manifest', () => {
    expect(validateManifest(manifest)).toBe(manifest);
  });

  it('rejects duplicate site identifiers and undocumented exclusions', () => {
    const invalid = structuredClone(manifest);
    invalid.sites = [
      invalid.sites[0]!,
      { site_id: 'site-001', url: 'https://example.net/', eligibility: 'excluded' },
    ];
    expect(() => validateManifest(invalid)).toThrow(/dupliqué/);
    expect(() => validateManifest(invalid)).toThrow(/exclusion_reason/);
  });

  it('requires dated sampling sources and anonymous site identifiers', () => {
    const invalid = structuredClone(manifest);
    invalid.study.sampling_frame = [{ source_url: 'not-a-url', retrieved_at: '9 octobre' }];
    invalid.sites[0]!.site_id = 'entreprise-nommee';
    expect(() => validateManifest(invalid)).toThrow(/source_url/);
    expect(() => validateManifest(invalid)).toThrow(/retrieved_at/);
    expect(() => validateManifest(invalid)).toThrow(/identifiant anonyme/);
  });

  it('accepts only root or recognized language homepages without credentials, query or hash', () => {
    expect(validateHomepageUrl('https://example.com/fr/').pathname).toBe('/fr/');
    expect(() => validateHomepageUrl('https://example.com/services/')).toThrow(/page d’accueil/);
    expect(() => validateHomepageUrl('https://example.com/?account=1')).toThrow(/paramètres/);
    expect(() => validateHomepageUrl('https://user:secret@example.com/')).toThrow(/identifiants/);
  });

  it('aggregates explicit denominators without a global score', () => {
    const observations = [
      {
        eligibility: 'included',
        final_status: 200,
        analyzable: true,
        banner_detected: 'yes',
        reject_first_layer: 'yes',
        dialog_role_present: true,
        dialog_accessible_name: 'yes',
        focus_indicator_heuristic: 'yes',
        privacy_link_in_banner: 'no',
        mobile_overflow_px: 0,
        keyboard_reject_steps: 3,
        external_hosts_before_choice_count: 4,
        cookies_before_choice_count: 2,
        document_storage_keys_before_choice_count: 1,
      },
      {
        eligibility: 'included',
        final_status: 200,
        analyzable: true,
        banner_detected: 'no',
        reject_first_layer: 'not_applicable',
        dialog_role_present: false,
        dialog_accessible_name: 'not_applicable',
        focus_indicator_heuristic: 'not_applicable',
        privacy_link_in_banner: 'not_applicable',
        mobile_overflow_px: null,
        keyboard_reject_steps: null,
        external_hosts_before_choice_count: 2,
        cookies_before_choice_count: 0,
        document_storage_keys_before_choice_count: 0,
      },
      {
        eligibility: 'included',
        final_status: 200,
        analyzable: true,
        banner_detected: 'indeterminate',
        cookies_before_choice_count: null,
        document_storage_keys_before_choice_count: null,
        external_hosts_before_choice_count: null,
      },
      {
        eligibility: 'included',
        final_status: null,
        banner_detected: 'indeterminate',
        cookies_before_choice_count: 0,
        document_storage_keys_before_choice_count: 0,
        external_hosts_before_choice_count: 0,
      },
    ];
    const aggregates = aggregateObservations(observations);
    expect(aggregates.find((row: { metric_id: string }) => row.metric_id === 'banner_detected')).toMatchObject({ denominator_n: 3, measured_n: 2, missing_n: 1, count: 1, pct: 50 });
    expect(aggregates.find((row: { metric_id: string }) => row.metric_id === 'reject_first_layer')).toMatchObject({ denominator_n: 1, measured_n: 1, count: 1, pct: 100 });
    expect(aggregates.find((row: { metric_id: string }) => row.metric_id === 'cookies_before_choice_count')).toMatchObject({ denominator_n: 3, measured_n: 2, missing_n: 1, median: 1, min: 0, max: 2 });
    expect(aggregates.every((row) => !Object.hasOwn(row, 'score'))).toBe(true);
  });

  it('keeps keyboard reachability in measured and missing counts', () => {
    const aggregates = aggregateObservations([
      {
        eligibility: 'included', final_status: 200, banner_detected: 'yes', reject_first_layer: 'yes',
        keyboard_reject_steps: 2, focus_indicator_heuristic: 'yes', reject_action_closed: 'yes',
      },
      {
        eligibility: 'included', final_status: 200, banner_detected: 'yes', reject_first_layer: 'yes',
        keyboard_reject_steps: null, focus_indicator_heuristic: 'indeterminate', reject_action_closed: 'indeterminate',
      },
    ]);
    expect(aggregates.find((row) => row.metric_id === 'keyboard_reject_steps')).toMatchObject({ denominator_n: 2, measured_n: 1, missing_n: 1, median: 2 });
    expect(aggregates.find((row) => row.metric_id === 'focus_indicator_heuristic')).toMatchObject({ denominator_n: 1, measured_n: 1, missing_n: 0, count: 1, pct: 100 });
    expect(aggregates.find((row) => row.metric_id === 'reject_action_closed')).toMatchObject({ denominator_n: 2, measured_n: 1, missing_n: 1, count: 1, pct: 100 });
  });

  it('does not turn missing categorical observations into negative results', () => {
    const aggregates = aggregateObservations([{
      eligibility: 'included', final_status: 200, banner_detected: 'yes', reject_first_layer: 'yes',
      reject_action_closed: 'indeterminate',
    }]);
    expect(aggregates.find((row) => row.metric_id === 'reject_action_closed')).toMatchObject({
      denominator_n: 1, measured_n: 0, missing_n: 1, count: 0, pct: null,
    });
  });

  it('excludes HTTP error pages from measured denominators', () => {
    const aggregates = aggregateObservations([
      { eligibility: 'included', final_status: 200, banner_detected: 'no' },
      { eligibility: 'included', final_status: 500, banner_detected: 'no' },
    ]);
    expect(aggregates.find((row) => row.metric_id === 'banner_detected')).toMatchObject({
      denominator_n: 1, measured_n: 1, missing_n: 0, count: 0, pct: 0,
    });
  });

  it('excludes HTTP responses that were classified as non-analyzable', () => {
    const aggregates = aggregateObservations([
      { eligibility: 'included', final_status: 200, analyzable: true, banner_detected: 'no' },
      { eligibility: 'included', final_status: 200, analyzable: false, analysis_reason: 'non_html', banner_detected: 'indeterminate' },
    ]);
    expect(aggregates.find((row) => row.metric_id === 'banner_detected')).toMatchObject({ denominator_n: 1, measured_n: 1 });
  });

  it('serializes stable JSON, CSV and hashes', () => {
    expect(stableJson({ z: 1, a: { d: 2, b: 3 } })).toBe('{\n  "a": {\n    "b": 3,\n    "d": 2\n  },\n  "z": 1\n}\n');
    expect(sha256('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(aggregatesToCsv([{ metric_id: 'a,b', denominator_n: 1 }])).toContain('"a,b"');
    expect(observationsToCsv([{ site_id: 'site-001', axe_rule_ids_banner: ['button-name', 'color-contrast'] }])).toContain('button-name|color-contrast');
  });

  it('never copies the private sampling seed into publishable study metadata', () => {
    const published = publicStudyMetadata({
      title: 'Pilote',
      selection_seed: 'secret-local',
      selection_seed_sha256: 'commitment',
      source_stats: [{ source_id: 'private-source' }],
      region_stats: [{ region: 'private-region' }],
      sampling_frame: [{ source_url: 'https://private.example/' }],
    });
    expect(published).toEqual({ title: 'Pilote', selection_seed_sha256: 'commitment', publication_rule: PUBLICATION_RULE });
    expect(JSON.stringify(published)).not.toContain('secret-local');
    expect(JSON.stringify(published)).not.toContain('private');
    expect(JSON.stringify(published)).not.toMatch(/identifiants pseudonymes, secteurs, régions et résultats/i);
  });

  it('allowlists public metrics while retaining the complete private result set', () => {
    const definitions = [
      { id: 'banner_detected' },
      { id: 'dialog_accessible_name' },
      { id: 'focus_indicator_heuristic' },
      { id: 'external_hosts_before_choice_count' },
    ];
    const aggregates = definitions.map(({ id }) => ({ metric_id: id }));
    const published = publicMetricResults(definitions as never, aggregates as never);
    expect(published.metric_definitions.map((row) => row.id)).toEqual(['banner_detected', 'external_hosts_before_choice_count']);
    expect(published.aggregates.map((row) => row.metric_id)).toEqual(['banner_detected', 'external_hosts_before_choice_count']);
    expect(definitions).toHaveLength(4);
    expect(aggregates).toHaveLength(4);
  });

  it('writes only allowlisted aggregates publicly and keeps raw evidence private', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'barometer-output-'));
    const observation = {
      site_id: 'site-001', eligibility: 'included', final_status: 200, analyzable: true,
      banner_detected: 'yes', reject_first_layer: 'yes', dialog_role_present: true,
      dialog_accessible_name: 'yes', focus_indicator_heuristic: 'yes', keyboard_reject_steps: 2,
      errors: ['private navigation error'],
    };
    const aggregates = aggregateObservations([observation]);
    await writeFile(join(directory, 'barometre-consentement-observations.csv'), 'stale private leak');
    await writeCollectorOutputs({
      outDir: directory,
      study: { id: 'pilot', minimum_public_breakdown_n: 5 },
      observations: [observation],
      aggregates,
      navigationLedger: [{ site_id: 'site-001', destination_url: 'https://private.example/deep' }],
      privateRun: { provenance: { git_dirty: true, git_sha: null } },
    });
    const publicJson = await readFile(join(directory, 'barometre-consentement.json'), 'utf8');
    const publicCsv = await readFile(join(directory, 'barometre-consentement-agregats.csv'), 'utf8');
    const privateResults = await readFile(join(directory, 'private/results.json'), 'utf8');
    const privateLedger = await readFile(join(directory, 'private/navigation-ledger.json'), 'utf8');
    expect(publicJson).toContain('banner_detected');
    expect(publicCsv).toContain('external_hosts_before_choice_count');
    for (const privateMetric of ['dialog_accessible_name', 'privacy_link_in_banner', 'focus_indicator_heuristic', 'mobile_overflow_px', 'external_hosts_after_reject_count']) {
      expect(publicJson).not.toContain(privateMetric);
      expect(publicCsv).not.toContain(privateMetric);
      expect(privateResults).toContain(privateMetric);
    }
    expect(publicJson).not.toContain('site-001');
    expect(publicJson).not.toContain('private.example');
    expect(privateLedger).toContain('private.example');
    if (process.platform !== 'win32') {
      expect((await stat(directory)).mode & 0o777).toBe(0o700);
      expect((await stat(join(directory, 'private'))).mode & 0o777).toBe(0o700);
      for (const path of [
        join(directory, 'barometre-consentement.json'),
        join(directory, 'barometre-consentement-agregats.csv'),
        join(directory, 'SHA256SUMS'),
        join(directory, 'private/results.json'),
        join(directory, 'private/navigation-ledger.json'),
      ]) {
        expect((await stat(path)).mode & 0o777).toBe(0o600);
      }
    }
    await expect(access(join(directory, 'barometre-consentement-observations.csv'))).rejects.toThrow();
    await rm(directory, { recursive: true, force: true });
    expect(METRIC_DEFINITIONS.length).toBeGreaterThan(8);
  });
});
