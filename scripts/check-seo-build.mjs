import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const readDist = (path) => readFile(resolve(root, 'dist', path), 'utf8');
const description =
  'Découvrez comment 27PM limite la collecte, l’utilisation et la conservation des renseignements personnels transmis par courriel sur son site web.';

const [home, privacy, robots, sitemap, vercelConfigText] = await Promise.all([
  readDist('index.html'),
  readDist('confidentialite/index.html'),
  readDist('robots.txt'),
  readDist('sitemap.xml'),
  readFile(resolve(root, 'vercel.json'), 'utf8'),
]);

const metaContent = (html, attribute, value) => {
  const tag = html.match(new RegExp(`<meta\\s+[^>]*${attribute}="${value}"[^>]*>`, 'i'))?.[0];
  assert.ok(tag, `missing meta ${attribute}=${value}`);
  return tag.match(/\bcontent="([^"]*)"/i)?.[1];
};

assert.match(home, /<meta\s+name="robots"\s+content="index, follow"/i, 'home must remain indexable');
assert.match(home, /<link\s+rel="canonical"\s+href="https:\/\/27pm\.org\/"/i, 'home canonical must remain stable');

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
  },
  {
    context: 'https://schema.org',
    type: 'WebPage',
    name: 'Politique de confidentialité | 27PM',
    url: 'https://27pm.org/confidentialite/',
    description,
    inLanguage: 'fr-CA',
  },
  'privacy JSON-LD must describe the visible page',
);
assert.match(privacy, /href="https:\/\/vercel\.com\/legal\/privacy-notice">Vercel<\/a>/, 'privacy copy must name Vercel');
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
  ],
  'Vercel must redirect explicit index documents to their canonical URLs',
);
assert.deepEqual(
  vercelConfig.headers,
  [
    {
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      ],
    },
  ],
  'Vercel must publish the approved security headers',
);

console.log('SEO build contract passed for https://27pm.org/.');
