import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const contentRoutes = JSON.parse(await readFile(new URL('src/content-routes.json', root), 'utf8'));
const siteMetadata = JSON.parse(await readFile(new URL('src/site-metadata.json', root), 'utf8'));
const dryRun = process.argv.includes('--dry-run');
const endpoint = process.env.INDEXNOW_ENDPOINT ?? 'https://api.indexnow.org/indexnow';
const publicPaths = ['/', '/confidentialite/', ...contentRoutes];
const metadataPaths = Object.keys(siteMetadata.lastModified);

assert.equal(new URL(siteMetadata.origin).pathname, '/', 'site origin must not contain a path');
assert.deepEqual(
  [...metadataPaths].sort(),
  [...publicPaths].sort(),
  'IndexNow URLs and sitemap metadata must describe the same public routes',
);
assert.match(siteMetadata.indexNowKey, /^[A-Za-z0-9-]{8,128}$/, 'IndexNow key format');

const origin = new URL(siteMetadata.origin);
const keyLocation = new URL(`/${siteMetadata.indexNowKey}.txt`, origin).href;
const payload = {
  host: origin.host,
  key: siteMetadata.indexNowKey,
  keyLocation,
  urlList: publicPaths.map((path) => new URL(path, origin).href),
};

if (dryRun) {
  console.log(JSON.stringify({ endpoint, payload }, null, 2));
  process.exit(0);
}

const keyResponse = await fetch(keyLocation, {
  headers: { 'user-agent': '27PM-IndexNow/1.0' },
  signal: AbortSignal.timeout(12_000),
});
assert.equal(keyResponse.status, 200, `IndexNow key must be public before submission: ${keyResponse.status}`);
assert.equal((await keyResponse.text()).trim(), siteMetadata.indexNowKey, 'public IndexNow key must match metadata');

const response = await fetch(endpoint, {
  method: 'POST',
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'user-agent': '27PM-IndexNow/1.0',
  },
  body: JSON.stringify(payload),
  signal: AbortSignal.timeout(12_000),
});
const responseBody = await response.text();
assert.ok(
  [200, 202].includes(response.status),
  `IndexNow rejected the submission (${response.status})${responseBody ? `: ${responseBody}` : ''}`,
);
console.log(`IndexNow accepted ${payload.urlList.length} canonical URLs (${response.status}).`);
