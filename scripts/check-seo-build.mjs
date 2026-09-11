import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const contentRoutes = JSON.parse(await readFile(resolve(root, 'src/content-routes.json'), 'utf8'));
const readDist = (path) => readFile(resolve(root, 'dist', path), 'utf8');
const analyticsApproved = process.env.VITE_ANALYTICS_APPROVED === 'true';
const crmApproved = process.env.VITE_CRM_INTAKE_APPROVED === 'true';
const generatedAssetsPath = 'assets/generated';
const contentSecurityPolicy = "default-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' https://challenges.cloudflare.com https://www.googletagmanager.com; script-src-attr 'none'; style-src 'self'; style-src-attr 'unsafe-inline'; img-src 'self' data: https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com; font-src 'self'; connect-src 'self' https://crm.27pm.org https://challenges.cloudflare.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com; frame-src https://challenges.cloudflare.com; manifest-src 'self'; worker-src 'none'; media-src 'none'; upgrade-insecure-requests";
const description =
  'Découvrez comment 27PM protège les renseignements transmis par formulaire ou courriel et utilise Google Analytics uniquement avec votre consentement.';
const directGoogleResource = /<(?:script|img|iframe|link)\b[^>]*(?:src|href)\s*=\s*["']https:\/\/(?:[^/"']+\.)?(?:googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|google\.com)(?:[/:"'])/i;

const [home, privacy, notFound, robots, sitemap, vercelConfigText] = await Promise.all([
  readDist('index.html'),
  readDist('confidentialite/index.html'),
  readDist('404.html'),
  readDist('robots.txt'),
  readDist('sitemap.xml'),
  readFile(resolve(root, 'vercel.json'), 'utf8'),
]);
const productionEnv = await readFile(resolve(root, '.env.production'), 'utf8');
const crmClientSource = await readFile(resolve(root, 'src/main.ts'), 'utf8');
const publicTurnstileSiteKey = productionEnv.match(
  /^VITE_TURNSTILE_SITE_KEY=(\S+)$/mu,
)?.[1];
assert.ok(publicTurnstileSiteKey, 'production must configure the public Turnstile sitekey');
const buildTurnstileSiteKey = process.env.VITE_TURNSTILE_SITE_KEY?.trim()
  || publicTurnstileSiteKey;
assert.match(
  productionEnv,
  /^VITE_CRM_INTAKE_APPROVED=false$/mu,
  'production CRM intake must remain explicitly unapproved by default',
);
assert.match(
  crmClientSource,
  /import\.meta\.env\.VITE_CRM_INTAKE_APPROVED === 'true'/,
  'the CRM client must require the exact approval value',
);

const metaContent = (html, attribute, value) => {
  const tag = html.match(new RegExp(`<meta\\s+[^>]*${attribute}="${value}"[^>]*>`, 'i'))?.[0];
  assert.ok(tag, `missing meta ${attribute}=${value}`);
  return tag.match(/\bcontent="([^"]*)"/i)?.[1];
};

assert.match(home, /<meta\s+name="robots"\s+content="index, follow"/i, 'home must remain indexable');
assert.match(home, /<link\s+rel="canonical"\s+href="https:\/\/27pm\.org\/"/i, 'home canonical must remain stable');

for (const [name, html] of [['home', home], ['privacy', privacy], ['404', notFound]]) {
  assert.match(html, /data-analytics-consent/, `${name} must expose the optional analytics consent control`);
  assert.match(html, /data-analytics-preferences/, `${name} must expose persistent analytics preferences`);
  assert.doesNotMatch(html, directGoogleResource, `${name} must not embed a pre-consent Google resource`);
}

const assetFiles = await readdir(resolve(root, 'dist', generatedAssetsPath));
assert.ok(assetFiles.length > 0, 'the build must emit generated assets');
for (const file of assetFiles) {
  assert.match(
    file,
    /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/,
    `generated asset must use a content-hashed name: ${file}`,
  );
}
const compiledJavascript = (
  await Promise.all(
    assetFiles
      .filter((file) => file.endsWith('.js'))
      .map((file) => readDist(`${generatedAssetsPath}/${file}`)),
  )
).join('\n');
if (crmApproved) {
  assert.ok(
    compiledJavascript.includes(buildTurnstileSiteKey),
    'approved CRM assets must contain the configured public Turnstile sitekey',
  );
  assert.match(
    compiledJavascript,
    /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/,
    'approved CRM assets must load Turnstile explicitly',
  );
  assert.match(
    compiledJavascript,
    /https:\/\/crm\.27pm\.org\/api\/public\/intake/,
    'approved CRM assets must target the intake endpoint',
  );
} else {
  assert.ok(
    !compiledJavascript.includes(buildTurnstileSiteKey),
    'unapproved CRM assets must exclude the configured public Turnstile sitekey',
  );
  assert.doesNotMatch(
    compiledJavascript,
    /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/,
    'unapproved CRM assets must exclude the Turnstile loader',
  );
  assert.doesNotMatch(
    compiledJavascript,
    /https:\/\/crm\.27pm\.org\/api\/public\/intake/,
    'unapproved CRM assets must exclude the intake endpoint',
  );
}
if (analyticsApproved) {
  assert.match(compiledJavascript, /G-S0SKT2CTV0/, 'approved assets must contain the GA4 measurement ID');
  assert.match(
    compiledJavascript,
    /www\.googletagmanager\.com\/gtag\/js/,
    'approved assets must contain the consent-gated Google tag loader',
  );
} else {
  assert.doesNotMatch(compiledJavascript, /G-S0SKT2CTV0/, 'unapproved assets must exclude the GA4 measurement ID');
  assert.doesNotMatch(
    compiledJavascript,
    /www\.googletagmanager\.com\/gtag\/js/,
    'unapproved assets must exclude the Google tag loader',
  );
}

assert.equal(metaContent(privacy, 'name', 'description'), description, 'privacy description must match approved copy');
assert.ok(description.length >= 120 && description.length <= 170, 'privacy description must contain 120–170 characters');
assert.equal(metaContent(privacy, 'name', 'robots'), 'index, follow', 'privacy page must remain indexable');
assert.match(
  privacy,
  /<link\s+rel="canonical"\s+href="https:\/\/27pm\.org\/confidentialite\/"/i,
  'privacy canonical must use the trailing-slash URL',
);

for (const [property, content] of [
  ['og:type', 'website'],
  ['og:locale', 'fr_CA'],
  ['og:site_name', '27PM'],
  ['og:url', 'https://27pm.org/confidentialite/'],
  ['og:title', 'Politique de confidentialité | 27PM'],
  ['og:description', description],
  ['og:image', 'https://27pm.org/assets/og-27pm-1200x630.png'],
  ['og:image:width', '1200'],
  ['og:image:height', '630'],
  ['og:image:alt', '27PM — Politique de confidentialité'],
]) {
  assert.equal(metaContent(privacy, 'property', property), content, `privacy ${property} must match`);
}
assert.equal(metaContent(privacy, 'name', 'twitter:card'), 'summary_large_image', 'privacy Twitter card must match');

const structuredDataText = privacy.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/i)?.[1];
assert.ok(structuredDataText, 'privacy page must publish JSON-LD');
const structuredData = JSON.parse(structuredDataText);
assert.deepEqual(
  {
    context: structuredData['@context'],
    type: structuredData['@type'],
    name: structuredData.name,
    url: structuredData.url,
    description: structuredData.description,
    inLanguage: structuredData.inLanguage,
    dateModified: structuredData.dateModified,
  },
  {
    context: 'https://schema.org',
    type: 'WebPage',
    name: 'Politique de confidentialité | 27PM',
    url: 'https://27pm.org/confidentialite/',
    description,
    inLanguage: 'fr-CA',
    dateModified: '2026-08-31',
  },
  'privacy JSON-LD must describe the visible page',
);
assert.match(privacy, /href="https:\/\/vercel\.com\/legal\/privacy-notice">Vercel<\/a>/, 'privacy copy must name Vercel');
assert.match(privacy, /Cloudflare Turnstile/, 'privacy copy must identify the anti-bot provider');
assert.match(privacy, /file d’examen/, 'privacy copy must disclose CRM review queueing');
assert.match(privacy, /Google Analytics 4/, 'privacy copy must identify the audience measurement provider');
assert.match(privacy, /aucun script Google Analytics n’est chargé/i, 'privacy copy must disclose pre-consent blocking');
assert.doesNotMatch(privacy, /GitHub Pages/i, 'privacy copy must not name the former host');

assert.match(robots, /Sitemap: https:\/\/27pm\.org\/sitemap\.xml/, 'robots must advertise the canonical sitemap');
assert.match(sitemap, /<loc>https:\/\/27pm\.org\/<\/loc>/, 'sitemap must include the homepage');
assert.match(
  sitemap,
  /<loc>https:\/\/27pm\.org\/confidentialite\/<\/loc>/,
  'sitemap must include the canonical privacy URL',
);

const vercelConfig = JSON.parse(vercelConfigText);
assert.equal(vercelConfig.trailingSlash, true, 'Vercel must redirect extensionless paths to trailing slashes');
assert.deepEqual(
  vercelConfig.redirects,
  [
    { source: '/index.html', destination: '/', permanent: true },
    {
      source: '/confidentialite/index.html',
      destination: '/confidentialite/',
      permanent: true,
    },
    ...contentRoutes.map((route) => ({ source: `${route}index.html`, destination: route, permanent: true })),
  ],
  'Vercel must redirect explicit index documents to their canonical URLs',
);
assert.deepEqual(
  vercelConfig.headers,
  [
    {
      source: '/assets/generated/(.*)',
      headers: [
        { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
      ],
    },
    {
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
  'Vercel must publish the approved security headers',
);
assert.ok(
  !vercelConfig.headers.some(({ source, headers }) => (
    source === '/assets/(.*)'
    && headers.some(({ key, value }) => (
      key.toLowerCase() === 'cache-control'
      && value.includes('immutable')
    ))
  )),
  'mutable-name public assets must not receive a broad immutable cache policy',
);
await assert.rejects(
  access(resolve(root, 'dist', '.nojekyll')),
  'the Vercel build must not retain a legacy GitHub Pages marker',
);

console.log('SEO build contract passed for https://27pm.org/.');
await import('./check-content-build.mjs');
