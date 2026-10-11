#!/usr/bin/env node
import { chmod, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { candidatesFromCsv, selectRegionBalanced } from './lib/consent-sampling.mjs';
import {
  PUBLICATION_RULE,
  preparePrivateArtifactsPath,
  SCHEMA_VERSION,
  sha256,
  stableJson,
  validateManifest,
} from './lib/consent-barometer.mjs';

const SOURCE_DEFINITIONS = [
  {
    id: 'sit-quebec-restauration',
    flag: 'restauration',
    sector: 'Restauration',
    source_url: 'https://www.donneesquebec.ca/recherche/dataset/17dfa825-9515-4fac-be6b-3964d25194c3/resource/64d52e5a-5cc5-40ce-a0c4-96c318087e97/download/sit-quebec-restauration.csv',
  },
  {
    id: 'sit-quebec-hebergements-collectifs',
    flag: 'hebergements',
    sector: 'Hébergement collectif',
    source_url: 'https://www.donneesquebec.ca/recherche/dataset/e9e2429f-7f23-41f2-bd0e-e41a6e349aa5/resource/16e84b47-4fa3-4079-bf00-8609939974e9/download/sit-quebec-hebergements-collectifs.csv',
  },
  {
    id: 'sit-quebec-culture-art-patrimoine',
    flag: 'culture',
    sector: 'Culture, art et patrimoine',
    source_url: 'https://www.donneesquebec.ca/recherche/dataset/8184607d-4969-4d29-ab12-7a1e0109bc46/resource/f0bf3291-0a9e-4133-a0c5-01c148eab9d2/download/sit-quebec-culture-art-et-patrimoine.csv',
  },
];

function usage() {
  console.log('Usage: npm run barometer:sample -- --restauration <csv> --hebergements <csv> --culture <csv> --retrieved-at YYYY-MM-DD --seed-file <fichier|-> --out <manifest.json> [--per-source 20]');
}

export function parseSamplingArgs(argv) {
  const args = { seedFile: null, perSource: 20 };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--help' || token === '-h') args.help = true;
    else if (token === '--restauration') args.restauration = argv[++index];
    else if (token === '--hebergements') args.hebergements = argv[++index];
    else if (token === '--culture') args.culture = argv[++index];
    else if (token === '--retrieved-at') args.retrievedAt = argv[++index];
    else if (token === '--out') args.out = argv[++index];
    else if (token === '--seed-file') args.seedFile = argv[++index];
    else if (token === '--per-source') args.perSource = Number(argv[++index]);
    else throw new Error(`Argument inconnu: ${token}`);
  }
  if (args.help) return args;
  for (const source of SOURCE_DEFINITIONS) {
    if (!args[source.flag]) throw new Error(`--${source.flag} est requis.`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.retrievedAt ?? '')) throw new Error('--retrieved-at doit suivre YYYY-MM-DD.');
  if (!args.out) throw new Error('--out est requis.');
  if (!args.seedFile?.trim()) throw new Error('--seed-file est requis et ne peut pas être vide.');
  if (!Number.isInteger(args.perSource) || args.perSource < 1) throw new Error('--per-source doit être un entier positif.');
  return args;
}

export async function readPrivateSeed(seedFile, reader = readFile) {
  const source = seedFile === '-' ? await reader(0, 'utf8') : await reader(resolve(seedFile), 'utf8');
  const seed = String(source).trim();
  if (seed.length < 32) throw new Error('La graine privée doit contenir au moins 32 caractères.');
  return seed;
}

export async function writePrivateManifest(outputPath, contents) {
  const outputDir = dirname(outputPath);
  await mkdir(outputDir, { recursive: true, mode: 0o700 });
  if (process.platform !== 'win32') {
    const details = await stat(outputDir);
    if ((details.mode & 0o077) !== 0) {
      throw new Error(`Le dossier du manifeste privé doit avoir les permissions 0700: ${outputDir}`);
    }
    await chmod(outputPath, 0o600).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
  }
  await writeFile(outputPath, contents, { mode: 0o600 });
  if (process.platform !== 'win32') await chmod(outputPath, 0o600);
}

async function main() {
  const args = parseSamplingArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const outputPath = await preparePrivateArtifactsPath(args.out, { kind: 'file', label: 'Le manifeste de sortie' });
  const seed = await readPrivateSeed(args.seedFile);
  const preparedSources = [];
  const samplingFrame = [];
  for (const definition of SOURCE_DEFINITIONS) {
    const source = await readFile(resolve(args[definition.flag]), 'utf8');
    const prepared = candidatesFromCsv(source, definition);
    preparedSources.push({ ...definition, candidates: prepared.candidates });
    samplingFrame.push({
      source_id: definition.id,
      source_url: definition.source_url,
      retrieved_at: args.retrievedAt,
      license: 'CC BY 4.0',
      source_sha256: sha256(source),
      record_count: prepared.row_count,
      ambiguous_host_count: prepared.ambiguous_host_count,
      candidate_host_count: prepared.candidates.length,
      exclusion_funnel: prepared.funnel,
    });
  }

  const selection = selectRegionBalanced(preparedSources, { perSource: args.perSource, seed });
  const manifest = validateManifest({
    schema_version: SCHEMA_VERSION,
    study: {
      id: 'barometre-consentement-tourisme-quebec-2026-pilote',
      resource_version: '0.1.0',
      title: 'Le droit de refuser fonctionne-t-il au clavier?',
      language: 'fr-CA',
      scope: `${selection.sites.length} pages d’accueil publiques d’établissements répertoriés dans SIT Québec.`,
      author: 'Alexis Boulet',
      publisher: '27PM',
      citation: 'Boulet, Alexis. « Le droit de refuser fonctionne-t-il au clavier? ». Baromètre 27PM, édition pilote 2026.',
      sampling_frame: samplingFrame,
      selection_rule: 'Les hôtes liés à plusieurs identifiants, régions ou sources sont exclus, de même que les plateformes sociales et de réservation et les URL profondes. Un flot déterministe retient vingt hôtes par source, au plus deux par cellule source-région, selon des quotas régionaux globaux calculés par capacité. Les candidats de chaque cellule sont triés par HMAC-SHA256 avec une graine privée.',
      selection_seed: seed,
      selection_seed_sha256: sha256(seed),
      target_per_source: args.perSource,
      source_region_cell_cap: 2,
      source_stats: selection.source_stats,
      region_stats: selection.region_stats,
      publication_rule: PUBLICATION_RULE,
      sampling_limitations: [
        'Les fichiers SIT Québec sont des aperçus non exhaustifs et ne constituent pas un registre de toutes les entreprises québécoises.',
        'Les fichiers CSV simplifient des données multidimensionnelles; l’unité observée ici est un hôte Web admissible, pas une entreprise statistique.',
        'L’échantillon est équilibré régionalement et par source; il n’est pas pondéré selon la population réelle des établissements.',
      ],
    },
    sites: selection.sites,
  });

  await writePrivateManifest(outputPath, stableJson(manifest));
  console.log(`Manifeste créé: ${selection.sites.length} sites pseudonymisés.`);
  for (const row of selection.source_stats) {
    console.log(`${row.source_id}: ${row.selected_count} sites, ${row.selected_region_count} régions, ${row.candidate_host_count} hôtes candidats.`);
  }
  console.log(`Empreinte du manifeste: ${sha256(stableJson(manifest))}`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    usage();
    process.exitCode = 1;
  });
}
