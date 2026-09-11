import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const contentRoutes = JSON.parse(await readFile(new URL('../src/content-routes.json', import.meta.url), 'utf8'));

const origin = new URL(process.env.PUBLIC_SITE_ORIGIN ?? 'https://27pm.org');
const timeoutMs = Number(process.env.PUBLIC_SITE_TIMEOUT_MS ?? 12_000);
const analyticsApproved = process.env.PUBLIC_SITE_ANALYTICS_APPROVED === 'true';
const crmApproved = process.env.PUBLIC_SITE_CRM_APPROVED === 'true';
const contentSecurityPolicy = "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com; script-src-attr 'none'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com; font-src 'self'; connect-src 'self' https://crm.27pm.org https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com; frame-src https://challenges.cloudflare.com; manifest-src 'self'; worker-src 'none'; media-src 'none'; upgrade-insecure-requests";
const crmIntakeEndpoint = new URL('https://crm.27pm.org/api/public/intake');
const directGoogleResource = /<(?:script|img|iframe|link)\b[^>]*(?:src|href)\s*=\s*["']https:\/\/(?:[^/"']+\.)?(?:googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|google\.com)(?:[/:"'])/i;
const verifiedDemoProjects = new Map([
  ['boulet', {
    href: 'https://fenetres-boulet-redesign.ales27pm.chatgpt.site/',
    allowedHosts: new Set(['fenetres-boulet-redesign.ales27pm.chatgpt.site']),
    marker: 'Portes et Fenêtres Boulet',
  }],
  ['turner', {
    href: 'https://ales27pm.github.io/s-turner/',
    allowedHosts: new Set(['ales27pm.github.io']),
    pathname: '/s-turner/',
    marker: 'Maisons S. Turner',
  }],
]);

assert.equal(origin.protocol, 'https:', 'PUBLIC_SITE_ORIGIN must use HTTPS');

const describeError = (error) => {
  if (!(error instanceof Error)) return String(error);
  const cause = error.cause instanceof Error ? ` (${error.cause.message})` : '';
  return `${error.message}${cause}`;
};

const get = async (url, options = {}) => {
  try {
    return await fetch(url, {
      redirect: 'follow',
      ...options,
      headers: {
        accept: 'text/html,application/xhtml+xml,*/*;q=0.8',
        'user-agent': '27PM-public-site-check/1.0',
        ...options.headers,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new Error(`${url}: ${describeError(error)}`, { cause: error });
  }
};

const requireOk = async (path, markers = []) => {
  const url = new URL(path, origin);
  const response = await get(url);
  const body = await response.text();
  const responseSummary = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 240);
  assert.ok(response.ok, `${url}: expected 2xx, received ${response.status}${responseSummary ? ` — ${responseSummary}` : ''}`);
  const finalUrl = new URL(response.url);
  assert.equal(finalUrl.protocol, 'https:', `${url}: final URL must use HTTPS`);
  assert.equal(finalUrl.origin, origin.origin, `${url}: final URL must stay on the canonical origin`);
  assert.equal(finalUrl.pathname, url.pathname, `${url}: final URL must preserve the canonical path`);

  for (const marker of markers) {
    assert.ok(body.includes(marker), `${url}: missing expected marker ${JSON.stringify(marker)}`);
  }
  return { body, response };
};

const requireProductionHeaders = (path, response) => {
  const expectedHeaders = new Map([
    ['content-security-policy', contentSecurityPolicy],
    ['x-content-type-options', 'nosniff'],
    ['referrer-policy', 'strict-origin-when-cross-origin'],
    ['x-frame-options', 'DENY'],
    ['permissions-policy', 'camera=(), microphone=(), geolocation=()'],
  ]);

  for (const [header, expectedValue] of expectedHeaders) {
    assert.equal(
      response.headers.get(header),
      expectedValue,
      `${new URL(path, origin)}: expected ${header}: ${expectedValue}`,
    );
  }
  assert.equal(
    response.headers.get('x-robots-tag'),
    null,
    `${new URL(path, origin)}: must not emit X-Robots-Tag`,
  );
};

const requireIndexablePage = (path, html) => {
  const attribute = (tag, name) => {
    const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
    return (match?.[1] ?? match?.[2] ?? match?.[3] ?? '').toLowerCase();
  };
  const metaTags = html.replace(/<!--[\s\S]*?-->/g, '').match(/<meta\b[^>]*>/gi) ?? [];
  let explicitIndexFollow = false;
  for (const tag of metaTags) {
    const crawler = attribute(tag, 'name');
    if (!['robots', 'googlebot', 'googlebot-news', 'bingbot'].includes(crawler)) continue;
    const directives = attribute(tag, 'content').split(/[\s,]+/);
    assert.ok(
      !directives.some((directive) => ['noindex', 'nofollow', 'none'].includes(directive)),
      `${path}: ${crawler} meta tag must not block indexing or link discovery`,
    );
    if (crawler === 'robots' && directives.includes('index') && directives.includes('follow')) {
      explicitIndexFollow = true;
    }
  }
  assert.ok(explicitIndexFollow, `${path}: must retain the explicit index, follow robots policy`);
};

const requireImmutableGeneratedAsset = (url, response) => {
  assert.match(
    url.pathname,
    /^\/assets\/generated\/.+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/,
    `${url}: compiled assets must use the generated content-hashed path`,
  );
  const cacheDirectives = new Set(
    (response.headers.get('cache-control') ?? '')
      .toLowerCase()
      .split(',')
      .map((directive) => directive.trim())
      .filter(Boolean),
  );
  assert.ok(cacheDirectives.has('public'), `${url}: generated assets must be publicly cacheable`);
  assert.ok(cacheDirectives.has('max-age=31536000'), `${url}: generated assets must cache for one year`);
  assert.ok(cacheDirectives.has('immutable'), `${url}: generated assets must be immutable`);
};

const requirePermanentRedirect = async (path, destination) => {
  const url = new URL(path, origin);
  const response = await get(url, { redirect: 'manual' });
  assert.ok(
    [301, 308].includes(response.status),
    `${url}: expected a permanent redirect, received ${response.status}`,
  );
  assert.equal(
    new URL(response.headers.get('location') ?? '', url).href,
    new URL(destination, origin).href,
    `${url}: redirect must target the canonical URL`,
  );
};

const { body: home, response: homeResponse } = await requireOk('/', [
  '<title>27PM | Sites web, applications et IA pour PME au Québec</title>',
  '<link rel="canonical" href="https://27pm.org/"',
  'Une idée. Plusieurs métiers.',
  'data-scenario-form',
  'Les choix saisis servent uniquement au résultat affiché',
  'data-analytics-consent',
  'data-analytics-preferences',
  'data-crm-intake',
  'Envoyer pour examen',
  'data-crm-unavailable',
  'Concept indépendant 27PM',
  'Non officiel et non déployé',
  'https://fenetres-boulet-redesign.ales27pm.chatgpt.site/',
  'https://ales27pm.github.io/s-turner/',
]);
requireProductionHeaders('/', homeResponse);
assert.doesNotMatch(home, /\.ts\.net/i, 'deployed home must not expose private Tailnet URLs');
assert.doesNotMatch(home, directGoogleResource, 'deployed home must not embed a pre-consent Google resource');

const { body: privacy, response: privacyResponse } = await requireOk('/confidentialite/', [
  'Politique de confidentialité',
  '<link rel="canonical" href="https://27pm.org/confidentialite/"',
  'Découvrez comment 27PM protège les renseignements transmis par formulaire ou courriel',
  '<meta property="og:url" content="https://27pm.org/confidentialite/"',
  '"@type": "WebPage"',
  'Google Analytics 4',
  'Cloudflare Turnstile',
  'file d’examen',
  'data-analytics-consent',
  'data-analytics-preferences',
  'https://vercel.com/legal/privacy-notice',
]);
requireProductionHeaders('/confidentialite/', privacyResponse);
const publicDocuments = new Map([['/', home], ['/confidentialite/', privacy]]);
for (const route of contentRoutes) {
  const { body, response } = await requireOk(route, [
    `href="https://27pm.org${route}"`,
    '"WebPage"',
    '"BreadcrumbList"',
    'data-analytics-preferences',
  ]);
  publicDocuments.set(route, body);
  requireProductionHeaders(route, response);
  assert.equal((body.match(/<h1\b/g) ?? []).length, 1, `${route}: must expose one H1`);
  await requirePermanentRedirect(route.slice(0, -1), route);
  await requirePermanentRedirect(`${route}index.html`, route);
}
for (const [path, html] of publicDocuments) requireIndexablePage(path, html);
assert.doesNotMatch(privacy, /GitHub Pages/i, 'deployed privacy copy must not name the former host');
assert.doesNotMatch(privacy, directGoogleResource, 'deployed privacy page must not embed a pre-consent Google resource');

function javascriptImports(source) {
  const imports = new Set();
  const tree = ts.createSourceFile('deployed.js', source, ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);
  const visit = (node) => {
    let specifier;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = node.moduleSpecifier;
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      specifier = node.arguments[0];
    }
    // StringLiteralLike includes static backtick imports, but excludes interpolation.
    if (specifier && ts.isStringLiteralLike(specifier)) imports.add(specifier.text);
    ts.forEachChild(node, visit);
  };
  visit(tree);
  return imports;
}

const javascriptAssetUrls = new Set(
  [...publicDocuments.values()].flatMap((html) =>
    [...html.matchAll(/(?:src|href)="([^"]+\.js)"/gi)].map(
      (match) => new URL(match[1], origin).href,
    ),
  ),
);
assert.ok(javascriptAssetUrls.size > 0, 'deployed pages must reference their JavaScript assets');
const deployedJavascriptParts = [];
for (const href of javascriptAssetUrls) {
  const url = new URL(href);
  assert.equal(url.origin, origin.origin, `${url}: JavaScript asset must stay on the canonical origin`);
  const response = await get(url, { headers: { accept: 'application/javascript,*/*;q=0.8' } });
  assert.ok(response.ok, `${url}: expected JavaScript asset, received ${response.status}`);
  assert.equal(new URL(response.url).origin, origin.origin, `${url}: JavaScript asset must not redirect off-site`);
  requireImmutableGeneratedAsset(url, response);
  const source = await response.text();
  deployedJavascriptParts.push(source);

  for (const specifier of javascriptImports(source)) {
    const dependency = new URL(specifier, url);
    if (!dependency.pathname.endsWith('.js')) continue;
    assert.equal(dependency.origin, origin.origin, `${dependency}: JavaScript dependency must stay on the canonical origin`);
    dependency.hash = '';
    javascriptAssetUrls.add(dependency.href);
  }
}
const deployedJavascript = deployedJavascriptParts.join('\n');
for (const [pattern, marker] of [
  [/challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/, 'Turnstile loader'],
  [/https:\/\/crm\.27pm\.org\/api\/public\/intake/, 'CRM intake endpoint'],
  [/crm_intake/, 'Turnstile action'],
]) {
  assert.equal(
    pattern.test(deployedJavascript),
    crmApproved,
    `deployed JavaScript must ${crmApproved ? 'include' : 'exclude'} the ${marker}`,
  );
}
for (const [pattern, marker] of [
  [/G-S0SKT2CTV0/, 'GA4 measurement ID'],
  [/www\.googletagmanager\.com\/gtag\/js/, 'consent-gated Google tag loader'],
]) {
  assert.equal(
    pattern.test(deployedJavascript),
    analyticsApproved,
    `deployed JavaScript must ${analyticsApproved ? 'include' : 'exclude'} the ${marker}`,
  );
}

const stylesheetAssetUrls = new Set(
  [...publicDocuments.values()].flatMap((html) =>
    [...html.matchAll(/(?:src|href)="([^"]+\.css)"/gi)].map(
      (match) => new URL(match[1], origin).href,
    ),
  ),
);
assert.ok(stylesheetAssetUrls.size > 0, 'deployed pages must reference their stylesheet assets');
const fontAssetUrls = new Set();
for (const href of stylesheetAssetUrls) {
  const url = new URL(href);
  assert.equal(url.origin, origin.origin, `${url}: stylesheet asset must stay on the canonical origin`);
  const response = await get(url, { headers: { accept: 'text/css,*/*;q=0.8' } });
  assert.ok(response.ok, `${url}: expected stylesheet asset, received ${response.status}`);
  requireImmutableGeneratedAsset(url, response);
  const stylesheet = await response.text();
  for (const match of stylesheet.matchAll(/url\((?:["']?)([^)"']+\.woff2)(?:["']?)\)/gi)) {
    fontAssetUrls.add(new URL(match[1], url).href);
  }
}
assert.ok(fontAssetUrls.size > 0, 'deployed stylesheets must reference their generated fonts');
for (const href of fontAssetUrls) {
  const url = new URL(href);
  assert.equal(url.origin, origin.origin, `${url}: font asset must stay on the canonical origin`);
  const response = await get(url, { headers: { accept: 'font/woff2,*/*;q=0.8' } });
  assert.ok(response.ok, `${url}: expected font asset, received ${response.status}`);
  requireImmutableGeneratedAsset(url, response);
}

const namedPublicImageUrl = new URL('/assets/og-27pm-1200x630.png', origin);
const namedPublicImageResponse = await get(namedPublicImageUrl, {
  headers: { accept: 'image/png,*/*;q=0.8' },
});
assert.ok(namedPublicImageResponse.ok, `${namedPublicImageUrl}: expected public image asset`);
assert.ok(
  !namedPublicImageResponse.headers.get('cache-control')?.includes('immutable'),
  `${namedPublicImageUrl}: mutable-name public images must not use immutable caching`,
);

const preflightHeaders = {
  'access-control-request-method': 'POST',
  'access-control-request-headers': 'content-type,idempotency-key',
};
const approvedPreflight = await get(crmIntakeEndpoint, {
  method: 'OPTIONS',
  redirect: 'manual',
  headers: { ...preflightHeaders, origin: origin.origin },
});
assert.ok(
  [200, 204].includes(approvedPreflight.status),
  `${crmIntakeEndpoint}: approved preflight must return a successful empty response`,
);
assert.equal(
  approvedPreflight.headers.get('access-control-allow-origin'),
  origin.origin,
  `${crmIntakeEndpoint}: CORS must allow only the canonical public origin`,
);
for (const method of ['POST', 'OPTIONS']) {
  assert.ok(
    approvedPreflight.headers.get('access-control-allow-methods')?.split(/\s*,\s*/).includes(method),
    `${crmIntakeEndpoint}: preflight must allow ${method}`,
  );
}
for (const header of ['content-type', 'idempotency-key']) {
  assert.ok(
    approvedPreflight.headers.get('access-control-allow-headers')
      ?.toLowerCase()
      .split(/\s*,\s*/)
      .includes(header),
    `${crmIntakeEndpoint}: preflight must allow ${header}`,
  );
}
assert.ok(
  approvedPreflight.headers.get('vary')
    ?.toLowerCase()
    .split(/\s*,\s*/)
    .includes('origin'),
  `${crmIntakeEndpoint}: CORS response must vary by Origin`,
);

const rejectedPreflight = await get(crmIntakeEndpoint, {
  method: 'OPTIONS',
  redirect: 'manual',
  headers: { ...preflightHeaders, origin: 'https://unapproved.example' },
});
assert.equal(
  rejectedPreflight.headers.get('access-control-allow-origin'),
  null,
  `${crmIntakeEndpoint}: unapproved origin must not receive a CORS grant`,
);

await requirePermanentRedirect('/confidentialite', '/confidentialite/');
await requirePermanentRedirect('/index.html', '/');
await requirePermanentRedirect('/confidentialite/index.html', '/confidentialite/');
const { body: robots } = await requireOk('/robots.txt');
// This site intentionally allows all crawlers. Any policy change must be reviewed,
// rather than passing merely because a Sitemap directive is still present.
const robotsPolicy = robots.split(/\r?\n/)
  .map((line) => line.replace(/#.*$/, '').trim())
  .filter(Boolean)
  .map((line) => {
    const colon = line.indexOf(':');
    return [line.slice(0, colon).trim().toLowerCase(), line.slice(colon + 1).trim()];
  });
assert.deepEqual(robotsPolicy, [
  ['user-agent', '*'],
  ['allow', '/'],
  ['sitemap', 'https://27pm.org/sitemap.xml'],
], 'robots.txt: must retain the approved allow-all crawler policy and canonical sitemap');
await requireOk('/sitemap.xml', ['https://27pm.org/confidentialite/', ...contentRoutes.map((route) => `https://27pm.org${route}`)]);

const missingUrl = new URL('/__27pm-public-check-missing__', origin);
const missingResponse = await get(missingUrl);
const missingBody = await missingResponse.text();
assert.equal(missingResponse.status, 404, `${missingUrl}: missing routes must return HTTP 404`);
assert.ok(missingBody.includes('Cette page est hors cadre.'), `${missingUrl}: missing routes must use the branded 404 document`);
assert.ok(missingBody.includes('data-analytics-consent'), `${missingUrl}: 404 must expose analytics consent controls`);
assert.doesNotMatch(missingBody, directGoogleResource, `${missingUrl}: 404 must not embed a pre-consent Google resource`);

if (origin.hostname === '27pm.org') {
  const wwwUrl = 'https://www.27pm.org/';
  const response = await get(wwwUrl, { redirect: 'manual' });
  assert.ok([301, 308].includes(response.status), `${wwwUrl}: expected a permanent redirect, received ${response.status}`);
  assert.equal(new URL(response.headers.get('location') ?? '', wwwUrl).href, 'https://27pm.org/', `${wwwUrl}: redirect must target the canonical root`);
}

const projectTags = [...home.matchAll(/<a\b[^>]*data-demo-project="([^"]+)"[^>]*>/gi)];
assert.equal(projectTags.length, verifiedDemoProjects.size * 2, 'deployed home must expose two links for each verified demo');

for (const [project, verifiedProject] of verifiedDemoProjects) {
  const projectHrefs = projectTags
    .filter((match) => match[1] === project)
    .map((match) => match[0].match(/\bhref="([^"]+)"/i)?.[1]);
  assert.deepEqual(projectHrefs, [verifiedProject.href, verifiedProject.href], `${project}: deployed links must use the reviewed URL`);

  const href = verifiedProject.href;
  const url = new URL(verifiedProject.href);
  assert.equal(url.protocol, 'https:', `${href}: public project links must use HTTPS`);
  assert.doesNotMatch(url.hostname, /\.ts\.net$/i, `${href}: private Tailnet destinations are forbidden`);

  const response = await get(url);
  assert.ok(response.ok, `${href}: expected 2xx, received ${response.status}`);
  const finalUrl = new URL(response.url);
  assert.equal(finalUrl.protocol, 'https:', `${href}: final project URL must use HTTPS`);
  assert.doesNotMatch(finalUrl.hostname, /\.ts\.net$/i, `${href}: final project URL must not enter a private Tailnet`);
  assert.ok(verifiedProject.allowedHosts.has(finalUrl.hostname), `${href}: final project host ${finalUrl.hostname} is not verified`);
  if (verifiedProject.pathname) assert.equal(finalUrl.pathname, verifiedProject.pathname, `${href}: final project path is not verified`);
  assert.ok((await response.text()).includes(verifiedProject.marker), `${href}: final page does not identify the verified project`);
}

console.log(`Public site contract passed for ${origin.href} (${publicDocuments.size} indexable pages, ${javascriptAssetUrls.size} JavaScript assets, ${stylesheetAssetUrls.size} stylesheets, ${fontAssetUrls.size} fonts).`);
