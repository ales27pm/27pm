import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, stat } from 'node:fs/promises';
import { basename, isAbsolute, relative, resolve, sep } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const archiveRoot = resolve(root, 'public/ressources');
const rootReal = await realpath(root);
const archiveRootReal = await realpath(archiveRoot);
const archiveRootStat = await lstat(archiveRoot);
const archiveRootRelative = relative(rootReal, archiveRootReal);
assert(archiveRootStat.isDirectory(), 'public/ressources must be a directory');
assert(!archiveRootStat.isSymbolicLink(), 'public/ressources must not be a symlink');
assert(archiveRootRelative && archiveRootRelative !== '..' && !archiveRootRelative.startsWith(`..${sep}`) && !isAbsolute(archiveRootRelative), 'public/ressources must stay inside the repository');
const manifestPath = resolve(root, 'docs/barometre-consentement-2026-archive-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));

const expectedResource = {
  version: '0.1.2',
  publication_date: '2026-10-11',
  canonical_url: 'https://27pm.org/ressources/barometre-consentement-2026/',
  subtitle: 'Baromètre 27PM 2026 — le refus au clavier sur 60 pages d’accueil',
  collection_date: '2026-10-11',
  author: 'Alexis Boulet',
  publisher: '27PM',
  license: 'cc-by-4.0'
};
const expectedFiles = new Map([
  ['barometre-consentement-2026.pdf', {
    path: 'public/ressources/barometre-consentement-2026.pdf',
    media_type: 'application/pdf',
    role: 'primary'
  }],
  ['barometre-consentement-2026-agregats.csv', {
    path: 'public/ressources/barometre-consentement-2026-agregats.csv',
    media_type: 'text/csv',
    role: 'supporting-data'
  }],
  ['barometre-consentement-2026.json', {
    path: 'public/ressources/barometre-consentement-2026.json',
    media_type: 'application/json',
    role: 'supporting-data'
  }]
]);

assert.deepEqual(manifest.resource, expectedResource);
assert.equal(manifest.manifest_version, '1.0');
assert.equal(manifest.resource.version, '0.1.2');
assert.equal(manifest.resource.license, 'cc-by-4.0');
assert.equal(manifest.zenodo.status, 'published');
assert.equal(manifest.zenodo.submitted, true);
assert.equal(manifest.zenodo.record_id, 23307073);
assert.equal(manifest.zenodo.doi, '10.5281/zenodo.23307073');
assert.equal(manifest.zenodo.concept_doi, '10.5281/zenodo.23307072');
assert.equal(manifest.zenodo.record_url, 'https://zenodo.org/records/23307073');
assert.equal(manifest.zenodo.api_url, 'https://zenodo.org/api/records/23307073');
assert.equal(manifest.zenodo.files_visibility, 'public');
assert.equal(manifest.zenodo.doi_origin, 'zenodo-minted');
assert.deepEqual(manifest.zenodo.resource_type, {
  type: 'publication',
  subtype: 'report',
  id: 'publication-report'
});
assert.equal(manifest.zenodo.version, manifest.resource.version);
assert.equal(manifest.zenodo.license, manifest.resource.license);
assert.equal(manifest.banq.status, 'administrative-prerequisites-pending');
assert.equal(manifest.zenodo.title, manifest.banq.title);
assert.equal(manifest.zenodo.publication_date, manifest.resource.publication_date);
assert.equal(manifest.zenodo.publisher, 'Zenodo');
assert.equal(manifest.zenodo.original_publisher, manifest.resource.publisher);
assert.equal(manifest.zenodo.language, 'fra');
assert.equal(manifest.zenodo.title, 'Le droit de refuser fonctionne-t-il au clavier?');
assert.deepEqual(manifest.zenodo.creators, [{
  type: 'personal',
  family_name: 'Boulet',
  given_name: 'Alexis',
  affiliation: '27PM'
}]);
assert.equal(manifest.zenodo.description, 'Le Baromètre 27PM 2026 présente une observation automatisée réalisée le 11 octobre 2026 sur 60 pages d’accueil associées à des établissements répertoriés dans trois jeux de données SIT Québec; 53 pages étaient analysables. Une bannière de consentement a été détectée sur 20 pages (37,7 %); parmi celles-ci, 17 présentaient une action de refus unique reconnue au premier niveau. Le dépôt publie huit agrégats révisés, leurs définitions et la méthode, sans nommer ni classer aucun site. L’échantillon est déterministe, non probabiliste et non pondéré; il ne représente ni toutes les PME ni l’ensemble des sites du Québec. Le dépôt contient le rapport PDF, le CSV agrégé et le JSON public, sous licence CC BY 4.0.');
assert.deepEqual(manifest.zenodo.additional_descriptions, [{
  type: 'methods',
  description: 'Échantillon déterministe équilibré par source et région, à parts égales parmi les trois sources SIT Québec. Chaque page a été chargée dans un contexte Chromium neuf — profil mobile 390 × 844, tactile, français canadien, fuseau America/Toronto. Après validation de la destination, du statut, du type HTML et de l’absence d’interstitiel, les huit agrégats publics ont été recalculés et revus indépendamment. Les noms, hôtes, URL et observations individuelles ne sont pas publiés.'
}]);
assert.deepEqual(manifest.zenodo.keywords, [
  'consentement numérique',
  'refus au clavier',
  'accessibilité Web',
  'bannières de consentement',
  'témoins (cookies)',
  'stockage Web',
  'vie privée',
  'pages d’accueil',
  'Québec',
  'données ouvertes',
  'SIT Québec'
]);

const filenames = new Set();
const paths = new Set();
const localMd5 = new Map();
let primaryCount = 0;
assert.equal(manifest.files.length, expectedFiles.size, 'The archive package must list exactly three files');
for (const file of manifest.files) {
  const expected = expectedFiles.get(file.filename);
  assert(expected, `Unexpected archive filename: ${file.filename}`);
  assert(!filenames.has(file.filename), `Duplicate archive filename: ${file.filename}`);
  assert(!paths.has(file.path), `Duplicate archive path: ${file.path}`);
  filenames.add(file.filename);
  paths.add(file.path);

  assert.equal(file.path, expected.path, `${file.filename} path`);
  assert.equal(file.media_type, expected.media_type, `${file.filename} media type`);
  assert.equal(file.role, expected.role, `${file.filename} role`);
  assert.equal(basename(file.path), file.filename, `${file.filename} path basename`);
  assert(!isAbsolute(file.path), `${file.filename} path must be relative`);
  if (file.role === 'primary') primaryCount += 1;

  const absolutePath = resolve(root, file.path);
  const pathStat = await lstat(absolutePath);
  assert(pathStat.isFile(), `${file.filename} must be a regular file`);
  assert(!pathStat.isSymbolicLink(), `${file.filename} must not be a symlink`);
  const absoluteReal = await realpath(absolutePath);
  const confinedPath = relative(archiveRootReal, absoluteReal);
  assert(confinedPath && confinedPath !== '..' && !confinedPath.startsWith(`..${sep}`) && !isAbsolute(confinedPath), `${file.filename} must stay under public/ressources`);
  const fileStat = await stat(absolutePath);
  const bytes = await readFile(absolutePath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const md5 = createHash('md5').update(bytes).digest('hex');
  localMd5.set(file.filename, { bytes: fileStat.size, md5 });

  assert.equal(fileStat.size, file.bytes, `${file.filename} byte size`);
  assert.equal(sha256, file.sha256, `${file.filename} SHA-256`);

  if (file.media_type === 'application/pdf') {
    assert.equal(bytes.subarray(0, 5).toString('ascii'), '%PDF-', 'PDF signature');
  }
  if (file.media_type === 'application/json') {
    JSON.parse(bytes.toString('utf8'));
  }
}

assert.equal(filenames.size, 3, 'The archival package must contain exactly PDF, CSV and JSON');
assert.equal(primaryCount, 1, 'The archival package must contain exactly one primary file');
assert.equal(manifest.zenodo.primary_file, 'barometre-consentement-2026.pdf');
assert.equal(manifest.zenodo.default_preview, 'barometre-consentement-2026-agregats.csv');
assert(filenames.has(manifest.zenodo.default_preview), 'The Zenodo preview file must be in the package');
assert(filenames.has(manifest.banq.deposit_file), 'The BAnQ deposit file must be in the package');
assert.deepEqual(manifest.zenodo.published_files, [
  'barometre-consentement-2026.pdf',
  'barometre-consentement-2026-agregats.csv',
  'barometre-consentement-2026.json'
].map((filename) => ({ filename, ...localMd5.get(filename) })));
assert.deepEqual(manifest.zenodo.related_works, [
  {
    identifier: manifest.resource.canonical_url,
    relation: 'isdocumentedby',
    resource_type: 'other'
  },
  ...[
    '17dfa825-9515-4fac-be6b-3964d25194c3',
    'e9e2429f-7f23-41f2-bd0e-e41a6e349aa5',
    '8184607d-4969-4d29-ab12-7a1e0109bc46'
  ].map((id) => ({
    identifier: `https://www.donneesquebec.ca/recherche/dataset/${id}`,
    relation: 'isderivedfrom',
    resource_type: 'dataset'
  }))
]);
assert.deepEqual(manifest.zenodo.official_guidance, [
  'https://help.zenodo.org/docs/deposit/create-new-upload/',
  'https://help.zenodo.org/docs/deposit/describe-records/resource-type/',
  'https://help.zenodo.org/docs/deposit/describe-records/reserve-doi/'
]);

assert.equal(manifest.banq.publication_type, 'publication numérique libre d’accès');
assert.equal(manifest.banq.price, 'gratuit');
assert.equal(manifest.banq.isbn, null);
assert.equal(manifest.banq.issn, null);
assert.equal(manifest.banq.distribution_url, 'https://27pm.org/ressources/barometre-consentement-2026.pdf');
assert.equal(manifest.banq.internal_target_date, '2026-10-18');
assert.equal(manifest.banq.legal_due_date, '2026-10-19');
assert.deepEqual(manifest.banq.administrative_prerequisites, [
  { id: 'publisher-account', status: 'not-confirmed' },
  { id: 'signed-free-publication-license', status: 'pending-user-signature' },
  { id: 'confirmation-email', status: 'required-at-submission', privacy: 'not-stored-in-repository' }
]);
assert.deepEqual(manifest.banq.official_guidance, [
  'https://www.banq.qc.ca/sites/default/files/2025-08/guide_depot_legal_publications_numeriques.pdf',
  'https://www.banq.qc.ca/sites/default/files/2024-09/licence_publications_gratuites.pdf',
  'https://depotlegal.banq.qc.ca/idel/public/inscription'
]);

if (manifest.zenodo.status === 'published') {
  assert.match(manifest.zenodo.doi, /^10\.5281\/zenodo\.\d+$/);
  assert.match(manifest.zenodo.record_url, /^https:\/\/zenodo\.org\/records\/\d+$/);
  assert.equal(manifest.zenodo.submitted, true);
}

console.log('Archive manifest passed: 3 verified files, BAnQ package and Zenodo metadata are coherent.');
