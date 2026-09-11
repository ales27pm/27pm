import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const dist = resolve(process.cwd(), 'dist');
const read = (path) => readFile(resolve(dist, path), 'utf8');
const analyticsApproved = process.env.VITE_ANALYTICS_APPROVED === 'true';
const normalizedPath = (process.env.PAGES_BASE_PATH ?? '/27pm').replace(/^\/+|\/+$/g, '');
const base = normalizedPath ? `/${normalizedPath}/` : '/';
const publicTurnstileSiteKey = '0x4AAAAAAEhozc0Mxhb3yUyb';
const generatedAssetsPath = 'assets/generated';
const verifiedDemoProjects = new Map([
  ['boulet', 'https://fenetres-boulet-redesign.ales27pm.chatgpt.site/'],
  ['turner', 'https://ales27pm.github.io/s-turner/'],
]);
const directGoogleResource = /<(?:script|img|iframe|link)\b[^>]*(?:src|href)\s*=\s*["']https:\/\/(?:[^/"']+\.)?(?:googletagmanager\.com|google-analytics\.com|analytics\.google\.com|doubleclick\.net|google\.com)(?:[/:"'])/i;

assert.notEqual(base, '/', 'the retired Pages profile must remain a non-root preview');
assert.equal(analyticsApproved, false, 'the Pages preview must keep analytics unapproved');

const [home, privacy, notFound, manifestText, nestedManifestText] = await Promise.all([
  read('index.html'),
  read('confidentialite/index.html'),
  read('404.html'),
  read('site.webmanifest'),
  read('assets/brand-v4/site.webmanifest'),
]);
const [crmSource, clientSource] = await Promise.all([
  readFile(resolve(process.cwd(), 'src/crm-intake.ts'), 'utf8'),
  readFile(resolve(process.cwd(), 'src/main.ts'), 'utf8'),
]);
const crmClientSource = `${crmSource}\n${clientSource}`;
const generatedAssetFiles = await readdir(resolve(dist, generatedAssetsPath));
assert.ok(generatedAssetFiles.length > 0, 'the Pages preview must emit generated assets');
for (const file of generatedAssetFiles) {
  assert.match(
    file,
    /-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/,
    `generated asset must use a content-hashed name: ${file}`,
  );
}
const clientCode = (
  await Promise.all(
    generatedAssetFiles
      .filter((name) => name.endsWith('.js'))
      .map((name) => read(`${generatedAssetsPath}/${name}`)),
  )
).join('\n');

for (const [name, html] of [['home', home], ['privacy', privacy]]) {
  assert.ok(
    html.includes('content="noindex, nofollow"'),
    `${name} must remain noindex in the retired Pages preview`,
  );
}

assert.doesNotMatch(privacy, /Selon le service d’hébergement retenu/i, 'privacy copy must identify the public host');
assert.match(privacy, /Vercel/, 'privacy copy must name the public host');
assert.doesNotMatch(privacy, /GitHub Pages/, 'privacy copy must not name the former public host');
assert.match(privacy, /Cloudflare Turnstile/, 'privacy copy must disclose the anti-bot provider');
assert.match(privacy, /file d’examen/, 'privacy copy must describe CRM review queueing');
assert.match(home, /<title>27PM \| Sites web, applications et IA sur mesure<\/title>/, 'home must publish the v5 title');
assert.match(home, /Une idée\. Plusieurs métiers\./, 'home must publish the v5 capabilities section');
assert.match(home, /data-scenario-form/, 'home must publish the local scenario builder');
assert.match(home, /data-contact-form/, 'home must publish the contextual contact brief');
assert.match(home, /Les choix saisis.+ne sont pas transmis à 27PM/, 'scenario builder must disclose its local-only behavior');
assert.match(home, /data-crm-intake/, 'home must publish the progressively enhanced CRM controls');
assert.match(home, /data-crm-unavailable/, 'home must preserve the no-configuration fallback');
assert.match(home, /name="website"/, 'home must publish the empty honeypot field');
assert.match(home, /data-crm-submit[^>]*>/, 'home must publish the guarded CRM submit control');
assert.match(crmClientSource, /https:\/\/crm\.27pm\.org\/api\/public\/intake/, 'client must target the public CRM intake endpoint');
assert.match(crmClientSource, /crm_intake/, 'client must request the expected Turnstile action');
assert.match(crmClientSource, /Idempotency-Key/, 'client must send an idempotency key');
assert.match(
  crmClientSource,
  /import\.meta\.env\.VITE_CRM_INTAKE_APPROVED === 'true'/,
  'client must require explicit CRM approval',
);

for (const [name, html] of [['home', home], ['privacy', privacy], ['404', notFound]]) {
  assert.match(html, /data-analytics-consent/, `${name} must expose the optional analytics consent control`);
  assert.match(html, /data-analytics-preferences/, `${name} must expose persistent analytics preferences`);
  assert.doesNotMatch(html, directGoogleResource, `${name} must not embed a pre-consent Google resource`);
}

const compiledJavascript = (
  await Promise.all(
    generatedAssetFiles
      .filter((file) => file.endsWith('.js'))
      .map((file) => read(`${generatedAssetsPath}/${file}`)),
  )
).join('\n');
assert.doesNotMatch(
  compiledJavascript,
  /https:\/\/crm\.27pm\.org\/api\/public\/intake/,
  'the retired Pages preview must exclude the CRM intake endpoint',
);
assert.doesNotMatch(
  compiledJavascript,
  /challenges\.cloudflare\.com\/turnstile\/v0\/api\.js\?render=explicit/,
  'the retired Pages preview must exclude the Turnstile loader',
);
assert.doesNotMatch(
  compiledJavascript,
  /crm_intake/,
  'the retired Pages preview must exclude the Turnstile action',
);
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

assert.doesNotMatch(
  clientCode,
  new RegExp(publicTurnstileSiteKey),
  'the Pages preview must keep the production Turnstile sitekey disabled',
);
await assert.rejects(
  access(resolve(dist, 'CNAME')),
  'the retired Pages preview must not claim the production domain',
);
await assert.rejects(
  access(resolve(dist, '.nojekyll')),
  'the retired Pages preview must not retain a legacy Jekyll marker',
);

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

console.log(`Retired GitHub Pages preview contract passed for ${base}.`);
process.env.CONTENT_PREVIEW_BASE = base;
await import('./check-content-build.mjs');
