import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const read = (path) => readFile(resolve(dist, path), 'utf8');
const normalizedPath = (process.env.PAGES_BASE_PATH ?? '/27pm').replace(/^\/+|\/+$/g, '');
const base = normalizedPath ? `/${normalizedPath}/` : '/';
const isPreview = (process.env.PAGES_HOST ?? 'ales27pm.github.io') !== '27pm.org';

const [home, privacy, notFound, manifestText, nestedManifestText] = await Promise.all([
  read('index.html'),
  read('confidentialite/index.html'),
  read('404.html'),
  read('site.webmanifest'),
  read('assets/brand-v4/site.webmanifest'),
]);

for (const [name, html] of [['home', home], ['privacy', privacy]]) {
  const robots = isPreview ? 'noindex, nofollow' : 'index, follow';
  assert.ok(html.includes(`content="${robots}"`), `${name} must use ${robots} on ${process.env.PAGES_HOST ?? 'ales27pm.github.io'}`);
}

assert.match(notFound, /content="noindex, nofollow"/, '404 must always remain non-indexable');

for (const [name, html] of [['home', home], ['privacy', privacy], ['404', notFound]]) {
  const rootRelativeUrls = [...html.matchAll(/(?:href|src)="(\/[^"]*)"/g)].map((match) => match[1]);
  for (const url of rootRelativeUrls) {
    assert.ok(url.startsWith(base), `${name} URL must remain inside ${base}: ${url}`);
  }
}

assert.ok(home.includes(`href="${base}confidentialite/"`), 'privacy link must include the Pages base path');
assert.ok(privacy.includes(`href="${base}"`), 'privacy return link must include the Pages base path');
assert.ok(notFound.includes(`href="${base}"`), '404 return link must include the Pages base path');
assert.ok(home.includes(`href="${base}site.webmanifest"`), 'manifest link must include the Pages base path');

const manifest = JSON.parse(manifestText);
assert.equal(manifest.start_url, '.', 'manifest start_url must remain portable');

for (const icon of manifest.icons) {
  assert.ok(!icon.src.startsWith('/'), `manifest icon must be relative: ${icon.src}`);
  await access(resolve(dist, icon.src));
}

const nestedManifest = JSON.parse(nestedManifestText);
assert.equal(nestedManifest.start_url, '../../', 'nested brand manifest must return to the site root');

for (const icon of nestedManifest.icons) {
  assert.ok(!icon.src.includes('/'), `nested manifest icon must be colocated: ${icon.src}`);
  await access(resolve(dist, 'assets/brand-v4', icon.src));
}

console.log(`GitHub Pages build contract passed for ${base} on ${process.env.PAGES_HOST ?? 'ales27pm.github.io'}.`);
