import { describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  candidatesFromCsv,
  normalizeHomepage,
  parseSemicolonCsv,
  selectRegionBalanced,
  type Candidate,
} from '../scripts/lib/consent-sampling.mjs';
import { parseSamplingArgs, readPrivateSeed, writePrivateManifest } from '../scripts/build-consent-barometer-sample.mjs';

describe('consent barometer deterministic sampling', () => {
  it('accepts a private seed only through a file or stdin reference', async () => {
    const common = ['--restauration', 'a.csv', '--hebergements', 'b.csv', '--culture', 'c.csv', '--retrieved-at', '2026-10-09', '--out', 'manifest.json'];
    expect(parseSamplingArgs([...common, '--seed-file', '-']).seedFile).toBe('-');
    expect(() => parseSamplingArgs([...common, '--seed', 'secret-in-argv'])).toThrow(/Argument inconnu/);
    await expect(readPrivateSeed('-', async (path) => path === 0 ? 'a'.repeat(32) : '')).resolves.toBe('a'.repeat(32));
    await expect(readPrivateSeed('-', async () => 'short')).rejects.toThrow(/32 caractères/);
  });
  it('writes the private manifest with restrictive filesystem permissions', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'barometer-manifest-'));
    const path = join(directory, 'sample-manifest.json');
    await writePrivateManifest(path, '{"private":true}\n');
    expect(await readFile(path, 'utf8')).toBe('{"private":true}\n');
    if (process.platform !== 'win32') {
      expect((await stat(directory)).mode & 0o777).toBe(0o700);
      expect((await stat(path)).mode & 0o777).toBe(0o600);
    }
    await rm(directory, { recursive: true, force: true });
  });
  it('parses quoted semicolons, escaped quotes and CRLF rows', () => {
    const rows = parseSemicolonCsv('IdentifiantUnique;SiteInternet;RegionAdministrative\r\n"A;1";"https://example.com/fr/";"Côte ""Nord"""\r\n');
    expect(rows).toEqual([{ IdentifiantUnique: 'A;1', SiteInternet: 'https://example.com/fr/', RegionAdministrative: 'Côte "Nord"' }]);
  });

  it('rejects malformed row widths and missing required headers', () => {
    expect(() => parseSemicolonCsv('A;B\n1;2;3\n')).toThrow(/3 colonnes au lieu de 2/);
    expect(() => candidatesFromCsv('IdentifiantUnique;SiteInternet\nA;https://example.com/\n', { id: 'source-a', sector: 'Secteur A' })).toThrow(/RegionAdministrative/);
  });

  it('normalizes public homepages and excludes platform listings', () => {
    expect(normalizeHomepage('example.com/fr/?utm_source=x')).toEqual({ url: 'https://example.com/fr/', host: 'example.com' });
    expect(normalizeHomepage('https://www.example.com/equipe')).toBeNull();
    expect(normalizeHomepage('https://facebook.com/example')).toBeNull();
    expect(normalizeHomepage('not a url')).toBeNull();
  });

  it('deduplicates repeated source rows by canonical host', () => {
    const csv = [
      'IdentifiantUnique;SiteInternet;RegionAdministrative',
      'B;https://www.example.com/;Estrie',
      'B;http://example.com/fr/;Estrie',
      'C;https://second.example/;Montréal',
    ].join('\n');
    const result = candidatesFromCsv(csv, { id: 'source-a', sector: 'Secteur A' });
    expect(result.row_count).toBe(3);
    expect(result.candidates).toHaveLength(2);
    expect(new Set(result.candidates.map((candidate) => candidate.host))).toEqual(new Set(['example.com', 'second.example']));
  });

  it('excludes a domain shared by multiple establishment identifiers', () => {
    const csv = [
      'IdentifiantUnique;SiteInternet;RegionAdministrative',
      'A;https://shared.example/;Estrie',
      'B;https://shared.example/;Montréal',
      'C;https://single.example/;Québec',
    ].join('\n');
    const result = candidatesFromCsv(csv, { id: 'source-a', sector: 'Secteur A' });
    expect(result.ambiguous_host_count).toBe(1);
    expect(result.candidates.map((candidate) => candidate.host)).toEqual(['single.example']);
  });

  it('records the sequential exclusion funnel', () => {
    const csv = [
      'IdentifiantUnique;SiteInternet;RegionAdministrative',
      'A;;Estrie',
      'B;450 555-0100;Estrie',
      'C;https://example.com/equipe;Estrie',
      'D;https://facebook.com/example;Estrie',
      'E;https://missing-region.example/;',
      ';https://missing-id.example/;Estrie',
      'F;https://eligible.example/;Estrie',
    ].join('\n');
    const result = candidatesFromCsv(csv, { id: 'source-a', sector: 'Secteur A' });
    expect(result.funnel).toMatchObject({
      input_record_count: 7,
      record_exclusions: {
        url_missing: 1,
        url_invalid: 1,
        deep_path: 1,
        platform_host: 1,
        region_missing: 1,
        record_id_missing: 1,
      },
      host_stage: { unique_host_before_ambiguity: 1, ambiguous_host: 0, eligible_host: 1 },
    });
  });

  it('selects deterministically across regions and removes cross-source duplicates', () => {
    const candidate = (source: string, host: string, region: string): Candidate => ({
      source_id: source,
      sector: source,
      region,
      url: `https://${host}/`,
      host,
      source_record_id: `${source}-${host}`,
    });
    const sources = [
      { id: 'a', candidates: [candidate('a', 'shared.example', 'Estrie'), candidate('a', 'a2.example', 'Montréal'), candidate('a', 'a3.example', 'Estrie')] },
      { id: 'b', candidates: [candidate('b', 'shared.example', 'Estrie'), candidate('b', 'b2.example', 'Montréal'), candidate('b', 'b3.example', 'Québec')] },
    ];
    const first = selectRegionBalanced(structuredClone(sources), { perSource: 2, seed: 'stable-seed' });
    const second = selectRegionBalanced(structuredClone(sources), { perSource: 2, seed: 'stable-seed' });
    expect(first).toEqual(second);
    expect(first.sites).toHaveLength(4);
    expect(new Set(first.sites.map((site) => new URL(site.url).hostname)).size).toBe(4);
    expect(first.sites.map((site) => new URL(site.url).hostname)).not.toContain('shared.example');
    expect(first.sites.map((site) => site.site_id)).toEqual(['site-001', 'site-002', 'site-003', 'site-004']);
    expect(first.source_stats.every((row) => row.selected_region_count === 2)).toBe(true);
    expect(first.source_stats.every((row) => row.selected_count === 2)).toBe(true);
    expect(first.region_stats.every((row) => row.quota === row.selected_count)).toBe(true);
  });

  it('adds at most one regional unit above the base quota to the largest residual capacity', () => {
    const make = (source: string, region: string, count: number): Candidate[] => Array.from({ length: count }, (_, index) => ({
      source_id: source,
      sector: source,
      region,
      url: `https://${source}-${region.toLowerCase()}-${index}.example/`,
      host: `${source}-${region.toLowerCase()}-${index}.example`,
      source_record_id: `${source}-${region}-${index}`,
    }));
    const selected = selectRegionBalanced([
      { id: 'a', candidates: [...make('a', 'A', 5), ...make('a', 'B', 2), ...make('a', 'C', 2)] },
      { id: 'b', candidates: [...make('b', 'A', 5), ...make('b', 'B', 2), ...make('b', 'C', 2)] },
    ], { perSource: 5, seed: 'private-test-seed' });
    expect(Object.fromEntries(selected.region_stats.map((row) => [row.region, row.quota]))).toEqual({ A: 4, B: 3, C: 3 });
    expect(selected.region_stats.every((row) => row.quota === row.selected_count)).toBe(true);
    expect(selected.source_stats.map((row) => row.selected_count)).toEqual([5, 5]);
  });
});
