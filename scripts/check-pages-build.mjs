import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const read = (path) => readFile(resolve(dist, path), 'utf8');
const pagesHost = process.env.PAGES_HOST ?? '27pm.org';
const isPreview = pagesHost !== '27pm.org';
const normalizedPath = (process.env.PAGES_BASE_PATH ?? (isPreview ? '/27pm' : '/')).replace(/^\/+|\/+$/g, '');
const base = normalizedPath ? `/${normalizedPath}/` : '/';
const verifiedDemoProjects = new Map([
  ['boulet', 'https://fenetres-boulet-redesign.ales27pm.chatgpt.site/'],
  ['turner', 'https://ales27pm.github.io/s-turner/'],
]);

assert.ok(isPreview || base === '/', '27pm.org production builds must use the root base path');

const [home, privacy, notFound, manifestText, nestedManifestText] = await Promise.all([
  read('index.html'),
  read('confidentialite/index.html'),
  read('404.html'),
  read('site.webmanifest'),
  read('assets/brand-v4/site.webmanifest'),
]);

for (const [name, html] of [['home', home], ['privacy', privacy]]) {
  const robots = isPreview ? 'noindex, nofollow' : 'index, follow';
  assert.ok(html.includes(`content="${robots}"`), `${name} must use ${robots} on ${pagesHost}`);
}

assert.doesNotMatch(privacy, /Selon le service d’hébergement retenu/i, 'privacy copy must identify the public host');
assert.match(privacy, /GitHub Pages/, 'privacy copy must name the public host');
assert.match(home, /<title>27PM \| Sites web, applications et IA sur mesure<\/title>/, 'home must publish the v5 title');
assert.match(home, /Une idée\. Plusieurs métiers\./, 'home must publish the v5 capabilities section');
assert.match(home, /data-scenario-form/, 'home must publish the local scenario builder');
assert.match(home, /data-contact-form/, 'home must publish the contextual contact brief');
assert.match(home, /Aucune donnée n’est envoyée/, 'scenario builder must disclose its local-only behavior');

const demoProjectTags = [...home.matchAll(/<a\b[^>]*data-demo-project[^>]*>/gi)].map((match) => match[0]);
assert.equal(demoProjectTags.length, verifiedDemoProjects.size * 2, 'each demo requires a text link and a visual link');
for (const [project, expectedHref] of verifiedDemoProjects) {
  const projectTags = demoProjectTags.filter((tag) => tag.includes(`data-demo-project="${project}"`));
  assert.equal(projectTags.length, 2, `${project} must expose exactly two demo links`);

  for (const tag of projectTags) {
    const href = tag.match(/\bhref="([^"]+)"/i)?.[1];
    assert.equal(href, expectedHref, `${project} must use its reviewed demo URL`);
    assert.match(tag, /\btarget="_blank"/i, `${project} demo links must open in a new tab`);
    assert.match(tag, /\brel="[^"]*nofollow[^"]*"/i, `${project} demo links must not endorse an unofficial destination`);
    assert.match(tag, /\brel="[^"]*noopener[^"]*"/i, `${project} demo links must isolate the new tab`);
    assert.match(tag, /\brel="[^"]*noreferrer[^"]*"/i, `${project} demo links must suppress referrer data`);
  }
}

assert.doesNotMatch(home, /\.ts\.net/i, 'build must not expose private Tailnet URLs');
for (const [marker, message] of [
  ['Concept indépendant 27PM', 'each demo must be identified as an independent 27PM concept'],
  ['Démo complète', 'each demo must be identified as a complete demo'],
  ['Non officiel et non déployé', 'each demo must be identified as unofficial and undeployed'],
]) {
  assert.equal(home.split(marker).length - 1, verifiedDemoProjects.size, message);
}
assert.match(
  home,
  /ni présentés,\s*ni approuvés,\s*ni déployés/i,
  'portfolio disclosure must state that the companies have not presented, approved or deployed the concepts',
);

for (const marker of ['data-scenario-form', 'data-contact-form']) {
  const formTag = home.match(new RegExp(`<form\\b[^>]*${marker}[^>]*>`, 'i'))?.[0];
  assert.ok(formTag, `${marker} form must exist`);
  assert.doesNotMatch(formTag, /\baction\s*=/i, `${marker} must not submit visitor data to a remote endpoint`);
}

if (isPreview) {
  await assert.rejects(access(resolve(dist, 'CNAME')), 'preview builds must not claim the production domain');
} else {
  assert.equal(await read('CNAME'), '27pm.org\n', 'production Pages builds must preserve the custom domain');
  assert.equal(await read('.nojekyll'), '', 'production Pages builds must disable Jekyll processing');
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

console.log(`GitHub Pages build contract passed for ${base} on ${pagesHost}.`);
