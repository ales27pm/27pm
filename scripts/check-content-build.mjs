import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFile(resolve(root, path), 'utf8');
const routes = JSON.parse(await read('src/content-routes.json'));
const draftRoutes = JSON.parse(await read('src/draft-routes.json'));
const siteMetadata = JSON.parse(await read('src/site-metadata.json'));
const creationSiteRoute = '/services/creation-sites-web/';
const agencyRoute = '/services/agence-web/';
const redesignRoute = '/services/refonte-site-web/';
const applicationsRoute = '/services/applications-web-sur-mesure/';
const automationRoute = '/services/automatisation-ia/';
const checklistRoute = '/ressources/checklist-fin-projet-web/';
const checklistJsonDownload = 'ressources/checklist-fin-projet-web.json';
const checklistImage = 'assets/checklist-fin-projet-web-1200x630.png';
const barometerRoute = '/ressources/barometre-consentement-2026/';
const barometerJsonDownload = 'ressources/barometre-consentement-2026.json';
const barometerCsvDownload = 'ressources/barometre-consentement-2026-agregats.csv';
const barometerImage = 'assets/barometre-consentement-2026-1200x630.png';
const authorRoute = '/auteurs/alexis-boulet/';
const serviceAreaCopyRoutes = new Set(['/', ...routes.filter((route) => route !== '/conditions-utilisation/')]);
const authorId = `${siteMetadata.origin}${authorRoute}#person`;
const activeGoogleProfile = 'https://www.google.com/maps?cid=5643245625813075394';
assert.ok(routes.includes(creationSiteRoute), 'the creation-site pillar route must stay published');
assert.ok(routes.includes(agencyRoute), 'the agency service route must be published');
assert.ok(routes.includes(redesignRoute), 'the website-redesign service route must be published');
assert.ok(routes.includes(applicationsRoute), 'the custom-application service route must be published');
assert.ok(routes.includes(automationRoute), 'the automation service route must be published');
assert.ok(routes.includes(checklistRoute), 'the end-of-project checklist resource route must be published');
assert.ok(!routes.includes(barometerRoute), 'the pending consent barometer must not be a published route');
assert.ok(draftRoutes.includes(barometerRoute), 'the pending consent barometer must remain an explicit draft route');
assert.ok(routes.includes(authorRoute), 'the Alexis Boulet author profile must be published');
const base = process.env.CONTENT_PREVIEW_BASE ?? '/';
const preview = process.env.CONTENT_PREVIEW_BASE !== undefined;
const origin = 'https://27pm.org';
const documents = new Map(await Promise.all(['/', '/confidentialite/', ...routes].map(async (route) => [
  route, await read(`dist${route}index.html`),
])));
const sitemap = await read('dist/sitemap.xml');
const llms = await read('dist/llms.txt');
const sitemapEntries = [...sitemap.matchAll(/<url><loc>([^<]+)<\/loc><lastmod>([^<]+)<\/lastmod><\/url>/g)]
  .map((match) => ({ url: match[1], path: new URL(match[1]).pathname, lastModified: match[2] }));
const sitemapPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map(([, url]) => new URL(url).pathname);
assert.deepEqual(sitemapPaths.sort(), [...documents.keys()].sort(), 'sitemap must enumerate exactly the published routes');
assert.ok(!sitemapPaths.includes(barometerRoute), 'pending barometer must remain outside the sitemap');
assert.ok(!llms.includes(`${siteMetadata.origin}${barometerRoute}`), 'pending barometer must remain outside llms.txt');
assert.equal(sitemapEntries.length, sitemapPaths.length, 'every sitemap URL must provide a lastmod date');
assert.deepEqual(
  Object.keys(siteMetadata.lastModified).sort(),
  [...documents.keys()].sort(),
  'site metadata must date every published route exactly once',
);
for (const { url, path, lastModified } of sitemapEntries) {
  assert.equal(url, `${siteMetadata.origin}${path}`, `${path}: sitemap URL must use the canonical origin`);
  assert.match(lastModified, /^\d{4}-\d{2}-\d{2}$/, `${path}: sitemap lastmod must use an ISO date`);
  assert.equal(lastModified, siteMetadata.lastModified[path], `${path}: sitemap lastmod must match reviewed metadata`);
  assert.ok(new Date(`${lastModified}T00:00:00Z`) <= new Date(), `${path}: sitemap lastmod cannot be in the future`);
}
const text = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const titles = new Set();
const descriptions = new Set();
const visiblyAuthoredRoutes = routes.filter((route) => (
  route.startsWith('/services/')
  || route.startsWith('/ressources/')
  || route.startsWith('/etudes/')
));

for (const [route, html] of documents) {
  const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
  const description = html.match(/<meta\s+name="description"\s+content="([^"]+)"/s)?.[1];
  assert.ok(title && !titles.has(title), `${route}: unique title required`);
  assert.ok(description && !descriptions.has(description), `${route}: unique description required`);
  titles.add(title);
  descriptions.add(description);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1, `${route}: one primary heading required`);
  assert.ok(html.includes(`href="${origin}${route}"`), `${route}: canonical must stay on production origin`);
  assert.match(html, preview ? /content="noindex, nofollow"/ : /content="index, follow"/, `${route}: indexation mode`);
  assert.match(html, /<meta\s+name="author"\s+content="Alexis Boulet"/i, `${route}: Alexis Boulet author metadata`);
  assert.doesNotMatch(
    text(html),
    /(?:créé|produit|généré)\s+(?:avec|par)\s+(?:l[’']?)?(?:IA|intelligence artificielle)|assistance générative/i,
    `${route}: no unrequired AI-production disclosure in published copy`,
  );
  assert.doesNotMatch(html, /10340\s+Marie-Victorin|J3R\s*0K2|"streetAddress"/i, `${route}: private service-area address must not be published`);
  assert.doesNotMatch(
    html,
    /https:\/\/www\.sortlist\.com\/agency\/27pm/i,
    `${route}: the unavailable Sortlist profile must not be cited`,
  );
  assert.doesNotMatch(
    html,
    /14495857269817067604/,
    `${route}: the permanently closed Google profile must not be cited`,
  );
  assert.doesNotMatch(
    text(html),
    /(?:rencontres?|rendez-vous|visites?|recev(?:ons|oir|re)|reçus?)[^.!?]{0,60}au studio/i,
    `${route}: site must not imply that clients are received at a physical location`,
  );
  assert.doesNotMatch(html, /à distance uniquement/i, `${route}: site must not describe an online-only business`);
  if (serviceAreaCopyRoutes.has(route)) {
    assert.match(
      text(html),
      /chez le client,\s+sur rendez-vous,\s+dans les zones desservies/i,
      `${route}: service-area meetings must be limited to the actual served areas`,
    );
    assert.match(
      text(html),
      /(?:de tout le Québec[^.!?]{0,80}à distance|à distance[^.!?]{0,80}(?:dans|partout au) tout le Québec)/i,
      `${route}: remote service must remain available across Quebec`,
    );
  }
  const graphs = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((match) => { const data = JSON.parse(match[1]); return data['@graph'] ?? [data]; });
  const webPage = graphs.find((node) => {
    const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
    return types.includes('WebPage') && node.url === `${origin}${route}`;
  });
  assert.ok(webPage, `${route}: WebPage schema`);
  assert.equal(webPage.author?.['@id'], authorId, `${route}: WebPage author must use the canonical Alexis Boulet entity`);
  const authorName = webPage.author?.name
    ?? graphs.find((node) => node['@type'] === 'Person' && node['@id'] === authorId)?.name;
  assert.equal(authorName, 'Alexis Boulet', `${route}: author name must stay explicit or resolve in the local graph`);
  if (!routes.includes(route)) continue;
  assert.match(html, /<html lang="fr-CA"/, `${route}: French Canadian document language`);
  assert.ok(html.includes(`property="og:url" content="${origin}${route}"`), `${route}: social URL must match canonical`);
  assert.ok(text(html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '').length > 1500, `${route}: useful initial HTML required`);
  assert.ok(graphs.some((node) => node['@type'] === 'BreadcrumbList'), `${route}: breadcrumb schema`);
  if (route.startsWith('/services/')) assert.ok(graphs.some((node) => node['@type'] === 'Service'), `${route}: service schema`);
  if (route.startsWith('/etudes/')) {
    assert.match(text(html), /indépendant/i, `${route}: independent concept disclosure`);
    assert.match(text(html), /non officiel/i, `${route}: unofficial concept disclosure`);
    assert.match(text(html), /non approuvé/i, `${route}: no implied endorsement`);
    assert.match(text(html), /non déployé/i, `${route}: no implied production deployment`);
  }
  if (visiblyAuthoredRoutes.includes(route)) {
    assert.match(
      html,
      new RegExp(`<p\\s+class="editorial-byline"[\\s\\S]*?href="${base}${authorRoute.slice(1)}"[\\s\\S]*?Alexis Boulet[\\s\\S]*?Mis à jour le 9 octobre 2026`, 'i'),
      `${route}: visible byline must link to the canonical author profile and publish the reviewed date`,
    );
  }
  assert.ok(html.includes(`href="${base}#contact"`), `${route}: reachable contact CTA`);
  assert.match(html, /data-analytics-preferences/, `${route}: persistent consent controls`);
  assert.doesNotMatch(html, /%BASE_URL%/, `${route}: base placeholders must be resolved`);
  const inbound = [...documents].filter(([source, body]) => source !== route && body.includes(`href="${base}${route.slice(1)}"`));
  assert.ok(inbound.length >= 2, `${route}: needs links from at least two distinct published pages`);
  for (const [, url] of html.matchAll(/(?:src|href)="(\/[^"]*)"/g)) {
    assert.ok(url.startsWith(base), `${route}: local URL must remain inside ${base}: ${url}`);
    const path = new URL(url, origin).pathname.slice(base.length);
    await access(resolve(root, 'dist', path.endsWith('/') || path === '' ? `${path}index.html` : path));
  }
}

const creationSite = documents.get(creationSiteRoute);
const agency = documents.get(agencyRoute);
const redesign = documents.get(redesignRoute);
const applications = documents.get(applicationsRoute);
const automation = documents.get(automationRoute);
const checklist = documents.get(checklistRoute);
const barometer = await read(`dist${barometerRoute}index.html`);
const authorProfile = documents.get(authorRoute);
assert.ok(creationSite, 'the creation-site pillar must be present in the build');
assert.ok(agency, 'the agency service page must be present in the build');
assert.ok(redesign, 'the website-redesign service page must be present in the build');
assert.ok(applications, 'the custom-application service page must be present in the build');
assert.ok(automation, 'the automation service page must be present in the build');
assert.ok(checklist, 'the end-of-project checklist resource must be present in the build');
assert.ok(barometer, 'the consent barometer resource must be present in the build');
assert.ok(authorProfile, 'the Alexis Boulet author profile must be present in the build');
for (const route of ['/', authorRoute, agencyRoute]) {
  assert.ok(
    documents.get(route)?.includes(`href="${activeGoogleProfile}"`),
    `${route}: visible identity copy must link to the active Google Business Profile`,
  );
}

const authorGraph = JSON.parse(
  authorProfile.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1] ?? '{}',
)['@graph'];
assert.ok(Array.isArray(authorGraph), 'author profile must publish a connected schema graph');
const profilePage = authorGraph.find((node) => {
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
  return types.includes('ProfilePage');
});
const authorPerson = authorGraph.find((node) => node['@type'] === 'Person' && node['@id'] === authorId);
assert.equal(profilePage?.mainEntity?.['@id'], authorId, 'ProfilePage must identify Alexis Boulet as its main entity');
assert.equal(authorPerson?.name, 'Alexis Boulet', 'author entity must keep the verified public name');
assert.equal(authorPerson?.jobTitle, 'Fondateur de 27PM', 'author profile must use the verified founder role');
assert.equal(authorPerson?.affiliation?.['@id'], `${origin}/#organization`, 'author profile must connect Alexis to 27PM');
assert.ok(authorPerson?.sameAs?.includes('https://github.com/ales27pm'), 'author profile must link to the verified public GitHub profile');
assert.match(text(authorProfile), /fondateur de 27PM/i, 'author profile must visibly state the founder relationship');
assert.match(authorProfile, /href="https:\/\/github\.com\/ales27pm"/, 'author profile must visibly link to the verified GitHub profile');
assert.match(authorProfile, new RegExp(`href="${base}${checklistRoute.slice(1)}`), 'author profile must link to the authored checklist');

const metaDescription = (html) => html.match(/<meta\s+name="description"\s+content="([^"]+)"/s)?.[1] ?? '';
const primaryHeading = (html) => html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
const creationText = text(creationSite);
const agencyText = text(agency);
const redesignText = text(redesign);
const checklistText = text(checklist);

assert.match(primaryHeading(creationSite), /création de site web/i, 'pillar H1 must clearly name the service');
assert.match(metaDescription(creationSite), /création site web/i, 'pillar description must contain the exact primary query');
assert.match(metaDescription(creationSite), /créer un site web/i, 'pillar description must contain the exact secondary query');
assert.ok(metaDescription(creationSite).length >= 120 && metaDescription(creationSite).length <= 170, 'pillar description must stay within 120–170 characters');
for (const topic of [
  /étapes de création d[’']un site web/i,
  /conception site internet/i,
  /design site internet/i,
  /développement site web/i,
  /site web d[’']entreprise/i,
]) {
  assert.match(creationText, topic, `pillar must cover ${topic}`);
}
for (const question of [
  /combien de temps/i,
  /combien coûte/i,
  /quelle plateforme/i,
  /hébergement.*canada/i,
]) {
  assert.match(creationText, question, `pillar FAQ must answer ${question}`);
}

assert.match(primaryHeading(agency), /agence web/i, 'agency H1 must contain the primary commercial query');
assert.match(metaDescription(agency), /agence web/i, 'agency description must contain the primary commercial query');
assert.match(metaDescription(agency), /agence création site/i, 'agency description must contain the secondary commercial query');
assert.ok(metaDescription(agency).length >= 120 && metaDescription(agency).length <= 170, 'agency description must stay within 120–170 characters');
for (const offer of [/conception site internet/i, /refonte site web/i, /développement sur mesure/i]) {
  assert.match(agencyText, offer, `agency comparison must cover ${offer}`);
}
assert.match(creationSite, new RegExp(`href="${base}${agencyRoute.slice(1)}`), 'pillar must link to agency page');
assert.match(agency, new RegExp(`href="${base}${creationSiteRoute.slice(1)}`), 'agency page must link to pillar');
assert.match(agencyText, /concepts? indépendants?/i, 'agency proof section must label independent concepts');
assert.match(agencyText, /ne (?:sont|constituent) (?:pas|ni).*clients?/i, 'agency proof section must not imply client work');

assert.match(primaryHeading(redesign), /refonte de site web/i, 'redesign H1 must contain the primary query');
assert.match(metaDescription(redesign), /refonte de site web/i, 'redesign description must contain the primary query');
assert.match(metaDescription(redesign), /québec/i, 'redesign description must identify the served market');
assert.ok(metaDescription(redesign).length >= 120 && metaDescription(redesign).length <= 170, 'redesign description must stay within 120–170 characters');
for (const topic of [
  /inventaire des URL/i,
  /plan de redirections/i,
  /search console/i,
  /accessibilité/i,
  /performance/i,
  /contrôle après la mise en ligne/i,
]) {
  assert.match(redesignText, topic, `redesign page must cover ${topic}`);
}
assert.match(redesign, new RegExp(`href="${base}${agencyRoute.slice(1)}`), 'redesign page must link to agency page');
assert.match(redesign, new RegExp(`href="${base}${creationSiteRoute.slice(1)}`), 'redesign page must link to creation pillar');
assert.match(agency, new RegExp(`href="${base}${redesignRoute.slice(1)}`), 'agency page must link to redesign service');
assert.match(creationSite, new RegExp(`href="${base}${redesignRoute.slice(1)}`), 'creation pillar must link to redesign service');

const redesignGraph = JSON.parse(
  redesign.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1] ?? '{}',
)['@graph'];
const redesignFaqPage = redesignGraph?.find((node) => node['@type'] === 'FAQPage');
assert.equal(redesignFaqPage?.mainEntity?.length, 5, 'redesign schema must describe every visible FAQ entry');
const visibleRedesignFaq = [...redesign.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/gi)]
  .map((match) => ({ name: text(match[1]), answer: text(match[2]) }));
assert.deepEqual(
  redesignFaqPage.mainEntity.map((item) => ({ name: item.name, answer: item.acceptedAnswer?.text })),
  visibleRedesignFaq,
  'redesign FAQ schema must match the visible questions and answers',
);

assert.equal(
  primaryHeading(checklist),
  'Checklist de fin de projet web : garder le contrôle',
  'checklist H1 must state the resource purpose',
);
assert.match(metaDescription(checklist), /checklist/i, 'checklist description must identify the resource format');
assert.match(metaDescription(checklist), /PME/i, 'checklist description must identify the intended audience');
assert.ok(metaDescription(checklist).length >= 120 && metaDescription(checklist).length <= 170, 'checklist description must stay within 120–170 characters');
assert.match(agency, new RegExp(`href="${base}${checklistRoute.slice(1)}`), 'agency page must link to the checklist');
assert.match(automation, new RegExp(`href="${base}${checklistRoute.slice(1)}`), 'automation page must link to the checklist');
assert.match(applications, new RegExp(`href="${base}${checklistRoute.slice(1)}`), 'custom-application page must link to the checklist');
assert.match(checklist, new RegExp(`href="${base}${automationRoute.slice(1)}`), 'checklist must link to the automation service');
assert.match(agency, new RegExp(`href="${base}${automationRoute.slice(1)}`), 'agency page must link to the automation service');
assert.match(creationSite, new RegExp(`href="${base}${automationRoute.slice(1)}`), 'creation pillar must link to the automation service');

const controlAreas = [
  ['domaine-dns', /domaine.*DNS|DNS.*domaine/i],
  ['hebergement-facturation', /hébergement.*facturation|facturation.*hébergement/i],
  ['code-deploiement', /code source.*déploiement|déploiement.*code source/i],
  ['contenus-licences', /contenus.*médias.*licences/i],
  ['comptes-acces', /comptes.*accès.*2FA/i],
  ['formulaires-donnees', /formulaires.*données.*confidentialité/i],
  ['analytique-integrations', /analytique.*Search Console.*intégrations/i],
  ['sauvegardes-continuite', /sauvegardes.*continuité.*support/i],
];
for (const [area, topic] of controlAreas) {
  const section = checklist.match(new RegExp(`<section\\s+id="${area}"\\s+data-control-area="${area}">([\\s\\S]*?)<\\/section>`, 'i'))?.[1] ?? '';
  assert.match(text(section), topic, `checklist must cover ${area}`);
  assert.match(text(section), /À vérifier\s*:/i, `${area} must state what to verify`);
  assert.match(text(section), /Preuves à conserver\s*:/i, `${area} must state which evidence to retain`);
  assert.match(checklist, new RegExp(`href="#${area}"`), `checklist summary must deep-link to ${area}`);
}

const recoveryCheck = checklist.match(/<ol\s+data-recovery-check>([\s\S]*?)<\/ol>/i)?.[1] ?? '';
assert.equal((recoveryCheck.match(/<li\b/g) ?? []).length, 6, 'the recovery check must contain six actions');
assert.match(checklistText, /Révision\s*:\s*9 octobre 2026/i, 'checklist must publish its dated revision');
assert.match(checklistText, /Version\s*:\s*1\.0\.0/i, 'checklist must publish its resource version');
assert.match(checklistText, /Auteur\s*:\s*Alexis Boulet/i, 'checklist must identify its author');
assert.match(checklistText, /Éditeur\s*:\s*27PM/i, 'checklist must identify its publisher');
for (const id of ['reponse-courte', 'methode', 'citer-cette-ressource', 'limites', 'historique-versions']) {
  assert.match(checklist, new RegExp(`<section\\s+id="${id}"`), `checklist must publish #${id}`);
}
assert.match(checklistText, /aucune certification juridique.*sécurité.*confidentialité.*accessibilité.*conformité/i, 'checklist must state its certification limits');
assert.match(checklistText, /adaptés? au périmètre réel/i, 'checklist must tell readers to adapt it to their scope');
assert.match(
  checklistText,
  /Boulet, Alexis.*Checklist de fin de projet web : garder le contrôle.*Version 1\.0\.0.*27PM.*9 octobre 2026/i,
  'checklist must publish a stable suggested citation',
);

const checklistDownload = 'ressources/checklist-fin-projet-web.csv';
assert.match(
  checklist,
  new RegExp(`href="${base}${checklistDownload}"[^>]*\\bdownload\\b`),
  'checklist page must link to the editable CSV download',
);
const checklistCsvBuffer = await readFile(resolve(root, 'dist', checklistDownload));
const checklistCsv = checklistCsvBuffer.toString('utf8');
const checklistRows = checklistCsv.trim().split(/\r?\n/);
const parseCsvRow = (row) => {
  const fields = [];
  let field = '';
  let quoted = false;
  for (let cursor = 0; cursor < row.length; cursor += 1) {
    const character = row[cursor];
    if (character === '"') {
      if (quoted && row[cursor + 1] === '"') {
        field += '"';
        cursor += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      fields.push(field);
      field = '';
    } else {
      field += character;
    }
  }
  assert.equal(quoted, false, 'checklist CSV row must have balanced quotes');
  fields.push(field);
  return fields;
};
const checklistTable = checklistRows.map(parseCsvRow);
assert.equal(checklistRows.length, 9, 'checklist CSV must contain one header and eight control areas');
assert.deepEqual(checklistTable[0], [
  'zone_de_controle',
  'quoi_verifier',
  'preuves_a_conserver',
  'responsable',
  'emplacement_preuve',
  'date_derniere_verification',
  'statut',
  'niveau_preuve',
  'notes',
], 'checklist CSV must publish the versioned nine-column contract');
for (const [index, row] of checklistTable.entries()) {
  assert.equal(row.length, 9, `checklist CSV row ${index + 1} must contain nine columns`);
}
for (const [, topic] of controlAreas) assert.match(checklistCsv, topic, `checklist CSV must cover ${topic}`);
const checklistCsvBytes = checklistCsvBuffer.byteLength;
const checklistCsvSha256 = createHash('sha256').update(checklistCsvBuffer).digest('hex');
const checklistJsonBuffer = await readFile(resolve(root, 'dist', checklistJsonDownload));
const checklistJsonSha256 = createHash('sha256').update(checklistJsonBuffer).digest('hex');
const checklistJsonBytes = checklistJsonBuffer.byteLength;
const checklistJson = JSON.parse(checklistJsonBuffer.toString('utf8'));
assert.equal(checklistJson.schema_version, '1.0', 'checklist JSON must publish its schema version');
assert.equal(checklistJson.resource_version, '1.0.0', 'checklist JSON must publish its resource version');
assert.equal(checklistJson.id, `${origin}${checklistRoute}#referentiel`, 'checklist JSON must use the stable dataset identifier');
assert.equal(checklistJson.canonical_url, `${origin}${checklistRoute}`, 'checklist JSON must identify the canonical HTML page');
assert.equal(checklistJson.date_published, '2026-10-08', 'checklist JSON must publish the visible release date');
assert.equal(checklistJson.date_modified, siteMetadata.lastModified[checklistRoute], 'checklist JSON date must match the sitemap date');
assert.equal(checklistJson.author?.name, 'Alexis Boulet', 'checklist JSON must identify its author');
assert.equal(checklistJson.publisher?.name, '27PM', 'checklist JSON must identify its publisher');
assert.equal(checklistJson.method?.default_state, 'a_verifier', 'checklist JSON must define the initial state');
assert.equal(checklistJson.method?.default_evidence_level, 'non_documente', 'checklist JSON must define the initial evidence level');
assert.match(checklistJson.method?.evidence_level_rule ?? '', /niveau le plus faible.*points applicables/i, 'checklist JSON must use the conservative evidence rule');
assert.equal(Object.hasOwn(checklistJson, 'overall_states'), false, 'checklist JSON must not publish an undefined aggregate state vocabulary');
assert.deepEqual(
  checklistJson.states.map((state) => state.id),
  ['a_verifier', 'verifie', 'a_corriger', 'non_applicable'],
  'checklist JSON must publish the four review states in order',
);
assert.equal(checklistJson.evidence_levels.length, 4, 'checklist JSON must publish four evidence levels');
assert.deepEqual(
  checklistJson.evidence_levels.map((level) => level.id),
  ['non_documente', 'documente', 'verifie', 'teste'],
  'checklist JSON must publish the four evidence identifiers in order',
);
assert.deepEqual(
  [...checklist.matchAll(/data-review-state-id="([^"]+)"/g)].map((match) => match[1]),
  checklistJson.states.map((state) => state.id),
  'visible review states and JSON review states must match',
);
assert.deepEqual(
  [...checklist.matchAll(/data-evidence-level-id="([^"]+)"/g)].map((match) => match[1]),
  checklistJson.evidence_levels.map((level) => level.id),
  'visible evidence levels and JSON evidence levels must match',
);
assert.deepEqual(
  checklistJson.controls.map((control) => control.id),
  controlAreas.map(([area]) => area),
  'checklist JSON and HTML must publish the same eight control identifiers',
);
assert.deepEqual(
  checklistTable.slice(1).map((row) => row[0]),
  checklistJson.controls.map((control) => control.name),
  'checklist CSV and JSON must publish the same eight control names in order',
);
for (const [index, row] of checklistTable.slice(1).entries()) {
  assert.equal(row[6], 'À vérifier', `checklist CSV control ${index + 1} must start in the review state`);
  assert.equal(row[7], 'non_documente', `checklist CSV control ${index + 1} must start at the conservative evidence level`);
  assert.ok(checklistJson.controls[index].minimum_evidence.length > 0, `checklist JSON control ${index + 1} must define evidence`);
}
assert.equal(checklistJson.csv_integrity.bytes, checklistCsvBytes, 'checklist JSON must publish the current CSV byte size');
assert.equal(checklistJson.csv_integrity.sha256, checklistCsvSha256, 'checklist JSON must publish the current CSV SHA-256');
assert.equal(
  checklistJson.citation?.recommended_text,
  'Boulet, Alexis. « Checklist de fin de projet web : garder le contrôle ». Version 1.0.0. 27PM, mise à jour le 9 octobre 2026. https://27pm.org/ressources/checklist-fin-projet-web/',
  'checklist JSON must publish the visible suggested citation',
);

const checklistGraph = JSON.parse(
  checklist.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1] ?? '{}',
)['@graph'];
assert.ok(Array.isArray(checklistGraph), 'checklist schema must publish a graph');
assert.ok(!checklistGraph.some((node) => node['@type'] === 'Service'), 'resource route must not use Service schema');
const checklistWebPage = checklistGraph.find((node) => node['@type'] === 'WebPage');
const checklistArticle = checklistGraph.find((node) => {
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
  return types.includes('TechArticle');
});
assert.equal(checklistWebPage?.author?.['@id'], authorId, 'checklist WebPage must identify its canonical author entity');
assert.equal(checklistWebPage?.mainEntity?.['@id'], `${origin}${checklistRoute}#article`, 'checklist WebPage must identify its article');
assert.equal(checklistArticle?.author?.['@id'], authorId, 'checklist article must identify its canonical author entity');
assert.equal(checklistArticle?.datePublished, '2026-10-08', 'checklist article must publish its release date');
assert.equal(checklistArticle?.dateModified, '2026-10-09', 'checklist article must publish its revision date');
assert.equal(checklistArticle?.version, '1.0.0', 'checklist article must publish the visible resource version');
assert.equal(checklistArticle?.image?.contentUrl, `${origin}/assets/checklist-fin-projet-web-1200x630.png`, 'checklist article must publish its dedicated image');
assert.equal(checklistArticle?.image?.width, 1200, 'checklist article image width');
assert.equal(checklistArticle?.image?.height, 630, 'checklist article image height');
const checklistDataset = checklistArticle?.hasPart;
assert.equal(checklistDataset?.['@type'], 'Dataset', 'checklist article must identify the accompanying dataset');
assert.equal(checklistDataset?.['@id'], checklistJson.id, 'checklist JSON and JSON-LD must use the same dataset identifier');
assert.equal(checklistDataset?.version, '1.0.0', 'checklist dataset must publish the visible resource version');
const checklistDistributions = checklistDataset?.distribution ?? [];
const checklistCsvDistribution = checklistDistributions.find((item) => item.encodingFormat === 'text/csv');
const checklistJsonDistribution = checklistDistributions.find((item) => item.encodingFormat === 'application/json');
assert.equal(
  checklistCsvDistribution?.contentUrl,
  `${origin}/ressources/checklist-fin-projet-web.csv`,
  'checklist article must identify its downloadable CSV',
);
assert.equal(checklistCsvDistribution?.contentSize, `${checklistCsvBytes} bytes`, 'checklist schema must publish the current CSV byte size');
assert.equal(checklistCsvDistribution?.sha256, checklistCsvSha256, 'checklist schema must publish the current CSV SHA-256');
assert.equal(checklistJsonDistribution?.contentUrl, `${origin}/ressources/checklist-fin-projet-web.json`, 'checklist article must identify its JSON representation');
assert.equal(checklistJsonDistribution?.contentSize, `${checklistJsonBytes} bytes`, 'checklist schema must publish the current JSON byte size');
assert.equal(checklistJsonDistribution?.sha256, checklistJsonSha256, 'checklist schema must publish the current JSON SHA-256');
assert.match(checklistText, new RegExp(`${checklistCsvBytes} octets`, 'i'), 'checklist must visibly publish the CSV byte size');
assert.match(checklistText, new RegExp(`SHA-256\\s*:\\s*${checklistCsvSha256}`, 'i'), 'checklist must visibly publish the CSV SHA-256');
assert.match(checklistText, new RegExp(`${checklistJsonBytes} octets`, 'i'), 'checklist must visibly publish the JSON byte size');
assert.match(checklistText, new RegExp(`SHA-256\\s*:\\s*${checklistJsonSha256}`, 'i'), 'checklist must visibly publish the JSON SHA-256');
assert.match(checklist, new RegExp(`href="${base}${checklistJsonDownload}"[^>]*\\bdownload\\b`), 'checklist page must link to the JSON download');
assert.match(checklist, /rel="alternate"\s+type="application\/json"\s+href="https:\/\/27pm\.org\/ressources\/checklist-fin-projet-web\.json"/, 'checklist page must advertise the JSON representation');
assert.match(checklist, /property="og:type"\s+content="article"/, 'checklist must use the article social type');
assert.match(checklist, new RegExp(`property="og:image"\\s+content="${origin}/${checklistImage}"`), 'checklist must publish its dedicated social image');
assert.match(
  checklist,
  /<img\s+class="brand__mark"[^>]+alt="27PM"/,
  'checklist brand image must publish explicit alternative text for Bing image processing',
);
const checklistImageBuffer = await readFile(resolve(root, 'dist', checklistImage));
assert.equal(checklistImageBuffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'checklist social image must be a PNG');
assert.equal(checklistImageBuffer.readUInt32BE(16), 1200, 'checklist social image width');
assert.equal(checklistImageBuffer.readUInt32BE(20), 630, 'checklist social image height');
assert.match(documents.get('/'), new RegExp(`href="${base}${checklistRoute.slice(1)}"`), 'homepage must link directly to the checklist');

const barometerText = text(barometer);
assert.equal(
  primaryHeading(barometer),
  'Le droit de refuser fonctionne-t-il au clavier?',
  'barometer H1 must state the research question',
);
assert.match(metaDescription(barometer), /Brouillon méthodologique/i, 'barometer description must disclose draft status');
assert.match(barometer, /<meta\s+name="robots"\s+content="noindex, nofollow"/i, 'pending barometer must remain non-indexable');
assert.match(barometerText, /Brouillon non publiable — recollecte v2 requise/i, 'barometer must visibly require recollection before publication');
assert.match(barometer, /data-results-status="pending"\s+data-publication-ready="false"/, 'barometer must expose the pending publication guard');
assert.match(barometerText, /Aucun résultat, dénominateur observé, pourcentage, médiane ou classement n’est publié/i, 'barometer must state that results are absent');
assert.match(barometerText, /ne représente ni toutes les PME ni l’ensemble des sites du Québec/i, 'barometer must prohibit broad extrapolation');
assert.match(barometerText, /Aucun site ne sera nommé ou classé/i, 'barometer must prohibit naming and rankings');
assert.match(barometerText, /ni un avis juridique, ni un verdict de conformité/i, 'barometer must state its legal limit');
const barometerResults = barometer.match(/<section id="resultats"[^>]*>[\s\S]*?<\/section>/i)?.[0] ?? '';
assert.match(barometerResults, /data-results-pending/, 'barometer results section must remain an explicit placeholder');
assert.doesNotMatch(barometerResults, /\b(?:55|19|16|13)\b/, 'barometer results placeholder must not retain v1 figures');
assert.doesNotMatch(barometerText, /55 pages|19 sur 55|16 sur 19|13 sur 16|médiane est de/i, 'barometer must not retain any v1 public assertion');

const barometerJsonBuffer = await readFile(resolve(root, 'dist', barometerJsonDownload));
const barometerCsvBuffer = await readFile(resolve(root, 'dist', barometerCsvDownload));
const barometerJson = JSON.parse(barometerJsonBuffer.toString('utf8'));
const barometerCsv = barometerCsvBuffer.toString('utf8');
const barometerJsonBytes = barometerJsonBuffer.byteLength;
const barometerCsvBytes = barometerCsvBuffer.byteLength;
const barometerJsonSha256 = createHash('sha256').update(barometerJsonBuffer).digest('hex');
const barometerCsvSha256 = createHash('sha256').update(barometerCsvBuffer).digest('hex');
assert.equal(barometerJson.schema_version, '1.0', 'barometer JSON schema version');
assert.equal(barometerJson.resource_version, '0.1.0-draft', 'barometer JSON resource version');
assert.equal(barometerJson.id, `${origin}${barometerRoute}#dataset`, 'barometer JSON dataset identifier');
assert.equal(barometerJson.canonical_url, `${origin}${barometerRoute}`, 'barometer JSON canonical URL');
assert.equal(barometerJson.author?.name, 'Alexis Boulet', 'barometer JSON author');
assert.equal(barometerJson.publisher?.name, '27PM', 'barometer JSON publisher');
assert.equal(barometerJson.scope?.status, 'planned', 'barometer JSON scope must remain planned');
assert.equal(barometerJson.scope?.target_homepages_n, 60, 'barometer JSON may describe only the planned target size');
assert.equal(barometerJson.publication_policy?.observations_published, false, 'individual observations must remain private');
assert.equal(barometerJson.publication_policy?.status, 'draft_pending_recollection', 'barometer public data must remain marked as a draft');
assert.equal(barometerJson.publication_policy?.publishable, false, 'pending barometer data must be explicitly non-publishable');
assert.equal(barometerJson.publication_policy?.results_status, 'pending', 'barometer results must remain pending');
assert.equal(barometerJson.publication_policy?.aggregates_published, false, 'pending barometer must not publish aggregates');
assert.equal(barometerJson.publication_policy?.metric_definitions_published, false, 'pending barometer must not publish metric definitions');
assert.deepEqual(barometerJson.metric_definitions, [], 'pending barometer definitions must remain empty');
assert.deepEqual(barometerJson.aggregates, [], 'pending barometer aggregates must remain empty');
const serializedBarometerJson = JSON.stringify(barometerJson);
for (const forbiddenKey of ['"observations"', '"site_id"', '"selected_homepages_n"', '"analyzed_homepages_n"', '"not_analyzed_n"', '"selection_seed"', '"selection_seed_sha256"', '"sample_manifest_sha256"', '"git_sha"']) {
  assert.ok(!serializedBarometerJson.includes(forbiddenKey), `barometer JSON must not expose ${forbiddenKey}`);
}
for (const forbiddenMetricId of ['dialog_accessible_name', 'privacy_link_in_banner', 'third_party_origins_after_reject_count', 'cookies_after_reject_count', 'storage_items_after_reject_count', 'focus_visible', 'mobile_overflow_px']) {
  assert.ok(!serializedBarometerJson.includes(forbiddenMetricId), `barometer JSON must not expose excluded metric ${forbiddenMetricId}`);
  assert.ok(!barometerCsv.includes(forbiddenMetricId), `barometer CSV must not expose excluded metric ${forbiddenMetricId}`);
}
const barometerRows = barometerCsv.trim().split(/\r?\n/).map(parseCsvRow);
assert.deepEqual(barometerRows[0], ['metric_id', 'denominator_n', 'measured_n', 'missing_n', 'count', 'pct', 'median', 'p25', 'p75', 'min', 'max'], 'barometer CSV contract');
assert.equal(barometerRows.length, 1, 'pending barometer CSV must contain its header only');
assert.ok(barometerRows.every((row) => row.length === 11), 'every barometer CSV row must contain eleven columns');

const barometerGraph = JSON.parse(
  barometer.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1] ?? '{}',
)['@graph'];
assert.ok(Array.isArray(barometerGraph), 'barometer schema must publish a connected graph');
assert.ok(!barometerGraph.some((node) => node['@type'] === 'Service'), 'barometer resource must not use Service schema');
const barometerWebPage = barometerGraph.find((node) => node['@type'] === 'WebPage');
const barometerArticle = barometerGraph.find((node) => {
  const types = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
  return types.includes('Article');
});
const barometerDataset = barometerGraph.find((node) => node['@type'] === 'Dataset');
assert.equal(barometerWebPage?.mainEntity?.['@id'], `${origin}${barometerRoute}#article`, 'barometer WebPage must identify its article');
assert.equal(barometerArticle?.author?.['@id'], authorId, 'barometer article must identify Alexis Boulet');
assert.equal(barometerArticle?.hasPart?.['@id'], barometerJson.id, 'barometer article must link to the dataset');
assert.equal(barometerDataset?.['@id'], barometerJson.id, 'barometer JSON and JSON-LD dataset IDs must match');
assert.equal(barometerDataset?.version, barometerJson.resource_version, 'barometer dataset version must match the public JSON');
assert.equal(barometerWebPage?.creativeWorkStatus, 'Draft', 'pending WebPage schema must remain Draft');
assert.equal(barometerArticle?.creativeWorkStatus, 'Draft', 'pending Article schema must remain Draft');
assert.equal(barometerDataset?.creativeWorkStatus, 'Draft', 'pending Dataset schema must remain Draft');
const barometerDistributions = barometerDataset?.distribution ?? [];
const barometerCsvDistribution = barometerDistributions.find((item) => item.encodingFormat === 'text/csv');
const barometerJsonDistribution = barometerDistributions.find((item) => item.encodingFormat === 'application/json');
assert.equal(barometerCsvDistribution?.contentUrl, `${origin}/${barometerCsvDownload}`, 'barometer schema CSV URL');
assert.equal(barometerCsvDistribution?.contentSize, `${barometerCsvBytes} bytes`, 'barometer schema CSV size');
assert.equal(barometerCsvDistribution?.sha256, barometerCsvSha256, 'barometer schema CSV integrity');
assert.equal(barometerJsonDistribution?.contentUrl, `${origin}/${barometerJsonDownload}`, 'barometer schema JSON URL');
assert.equal(barometerJsonDistribution?.contentSize, `${barometerJsonBytes} bytes`, 'barometer schema JSON size');
assert.equal(barometerJsonDistribution?.sha256, barometerJsonSha256, 'barometer schema JSON integrity');
assert.match(barometerText, new RegExp(`${barometerCsvBytes} octets`, 'i'), 'barometer must visibly publish the CSV byte size');
assert.match(barometerText, new RegExp(String.raw`SHA-256\s*:\s*${barometerCsvSha256}`, 'i'), 'barometer must visibly publish the CSV SHA-256');
assert.match(barometerText.replaceAll('&nbsp;', ''), new RegExp(`${barometerJsonBytes} octets`, 'i'), 'barometer must visibly publish the JSON byte size');
assert.match(barometerText, new RegExp(String.raw`SHA-256\s*:\s*${barometerJsonSha256}`, 'i'), 'barometer must visibly publish the JSON SHA-256');
assert.match(barometer, new RegExp(`href="${base}${barometerCsvDownload}"[^>]*\\bdownload\\b`), 'barometer page must link to the aggregate CSV');
assert.match(barometer, new RegExp(`href="${base}${barometerJsonDownload}"[^>]*\\bdownload\\b`), 'barometer page must link to the cleaned JSON');
assert.match(barometer, /rel="alternate"\s+type="application\/json"\s+href="https:\/\/27pm\.org\/ressources\/barometre-consentement-2026\.json"/, 'barometer must advertise its JSON representation');
assert.match(barometer, new RegExp(`property="og:image"\\s+content="${origin}/${barometerImage}"`), 'barometer must publish its dedicated social image');
const barometerImageBuffer = await readFile(resolve(root, 'dist', barometerImage));
assert.equal(barometerImageBuffer.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'barometer social image must be a PNG');
assert.equal(barometerImageBuffer.readUInt32BE(16), 1200, 'barometer social image width');
assert.equal(barometerImageBuffer.readUInt32BE(20), 630, 'barometer social image height');
for (const [route, html] of documents) {
  assert.ok(!html.includes(`href="${base}${barometerRoute.slice(1)}"`), `${route}: published pages must not link to the pending barometer`);
}

const creationGraph = JSON.parse(
  creationSite.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1] ?? '{}',
)['@graph'];
const faqPage = creationGraph?.find((node) => node['@type'] === 'FAQPage');
assert.equal(faqPage?.mainEntity?.length, 5, 'pillar schema must describe every visible FAQ entry');
const visibleFaq = [...creationSite.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/gi)]
  .map((match) => ({ name: text(match[1]), answer: text(match[2]) }));
assert.deepEqual(
  faqPage.mainEntity.map((item) => ({ name: item.name, answer: item.acceptedAnswer?.text })),
  visibleFaq,
  'FAQ schema must match the visible questions and answers',
);
console.log(`Content SEO contract passed: ${routes.length} detail pages, ${documents.size} sitemap URLs, ${preview ? 'preview' : 'production'} mode.`);
