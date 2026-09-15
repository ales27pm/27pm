import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const read = (path) => readFile(resolve(root, path), 'utf8');
const routes = JSON.parse(await read('src/content-routes.json'));
const creationSiteRoute = '/services/creation-sites-web/';
const agencyRoute = '/services/agence-web/';
assert.ok(routes.includes(creationSiteRoute), 'the creation-site pillar route must stay published');
assert.ok(routes.includes(agencyRoute), 'the agency service route must be published');
const base = process.env.CONTENT_PREVIEW_BASE ?? '/';
const preview = process.env.CONTENT_PREVIEW_BASE !== undefined;
const origin = 'https://27pm.org';
const documents = new Map(await Promise.all(['/', '/confidentialite/', ...routes].map(async (route) => [
  route, await read(`dist${route}index.html`),
])));
const sitemap = await read('dist/sitemap.xml');
const sitemapPaths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => new URL(match[1]).pathname);
assert.deepEqual(sitemapPaths.sort(), [...documents.keys()].sort(), 'sitemap must enumerate exactly the published routes');
const text = (html) => html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const titles = new Set();
const descriptions = new Set();

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
  if (!routes.includes(route)) continue;
  assert.match(html, /<html lang="fr-CA"/, `${route}: French Canadian document language`);
  assert.ok(html.includes(`property="og:url" content="${origin}${route}"`), `${route}: social URL must match canonical`);
  assert.ok(text(html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1] ?? '').length > 1500, `${route}: useful initial HTML required`);
  const graphs = [...html.matchAll(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .flatMap((match) => { const data = JSON.parse(match[1]); return data['@graph'] ?? [data]; });
  assert.ok(graphs.some((node) => node['@type'] === 'WebPage' && node.url === `${origin}${route}`), `${route}: WebPage schema`);
  assert.ok(graphs.some((node) => node['@type'] === 'BreadcrumbList'), `${route}: breadcrumb schema`);
  if (route.startsWith('/services/')) assert.ok(graphs.some((node) => node['@type'] === 'Service'), `${route}: service schema`);
  if (route.startsWith('/etudes/')) {
    assert.match(text(html), /indépendant/i, `${route}: independent concept disclosure`);
    assert.match(text(html), /non officiel/i, `${route}: unofficial concept disclosure`);
    assert.match(text(html), /non approuvé/i, `${route}: no implied endorsement`);
    assert.match(text(html), /non déployé/i, `${route}: no implied production deployment`);
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
assert.ok(creationSite, 'the creation-site pillar must be present in the build');
assert.ok(agency, 'the agency service page must be present in the build');

const metaDescription = (html) => html.match(/<meta\s+name="description"\s+content="([^"]+)"/s)?.[1] ?? '';
const primaryHeading = (html) => html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1].replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() ?? '';
const creationText = text(creationSite);
const agencyText = text(agency);

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
