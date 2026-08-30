import assert from 'node:assert/strict';

const origin = new URL(process.env.PUBLIC_SITE_ORIGIN ?? 'https://27pm.org');
const timeoutMs = Number(process.env.PUBLIC_SITE_TIMEOUT_MS ?? 12_000);
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
  '<title>27PM | Sites web, applications et IA sur mesure</title>',
  '<link rel="canonical" href="https://27pm.org/"',
  'Une idée. Plusieurs métiers.',
  'data-scenario-form',
  'Aucune donnée n’est envoyée',
  'Concept indépendant 27PM',
  'Non officiel et non déployé',
  'https://fenetres-boulet-redesign.ales27pm.chatgpt.site/',
  'https://ales27pm.github.io/s-turner/',
]);
requireProductionHeaders('/', homeResponse);
assert.doesNotMatch(home, /\.ts\.net/i, 'deployed home must not expose private Tailnet URLs');

const { body: privacy, response: privacyResponse } = await requireOk('/confidentialite/', [
  'Politique de confidentialité',
  '<link rel="canonical" href="https://27pm.org/confidentialite/"',
  'Découvrez comment 27PM limite la collecte, l’utilisation et la conservation',
  '<meta property="og:url" content="https://27pm.org/confidentialite/"',
  '"@type": "WebPage"',
  'https://vercel.com/legal/privacy-notice',
]);
requireProductionHeaders('/confidentialite/', privacyResponse);
assert.doesNotMatch(privacy, /GitHub Pages/i, 'deployed privacy copy must not name the former host');
await requirePermanentRedirect('/confidentialite', '/confidentialite/');
await requirePermanentRedirect('/index.html', '/');
await requirePermanentRedirect('/confidentialite/index.html', '/confidentialite/');
await requireOk('/robots.txt', ['Sitemap: https://27pm.org/sitemap.xml']);
await requireOk('/sitemap.xml', ['https://27pm.org/confidentialite/']);

const missingUrl = new URL('/__27pm-public-check-missing__', origin);
const missingResponse = await get(missingUrl);
const missingBody = await missingResponse.text();
assert.equal(missingResponse.status, 404, `${missingUrl}: missing routes must return HTTP 404`);
assert.ok(missingBody.includes('Cette page est hors cadre.'), `${missingUrl}: missing routes must use the branded 404 document`);

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

console.log(`Public site contract passed for ${origin.href}`);
