import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../dist/${path}`, import.meta.url), 'utf8');
const robots = await read('robots.txt');
assert.match(robots, /Disallow: \//, 'preview robots must block crawling');
assert.doesNotMatch(robots, /Sitemap:/i, 'preview robots must not advertise a sitemap');
const names = await readdir(new URL('../dist/assets/generated/', import.meta.url));
const scripts = (await Promise.all(names.filter((name) => name.endsWith('.js')).map((name) => read(`assets/generated/${name}`)))).join('\n');
assert.doesNotMatch(scripts, /G-S0SKT2CTV0|www\.googletagmanager\.com\/gtag\/js/, 'preview must exclude GA4');
assert.doesNotMatch(scripts, /crm\.27pm\.org\/api\/public\/intake|turnstile\/v0\/api\.js/, 'preview must exclude CRM submission and Turnstile');
assert.match(await read('404.html'), /content="noindex, nofollow"/, 'preview 404 must stay noindex');
process.env.CONTENT_PREVIEW_BASE ??= '/';
await import('./check-content-build.mjs');
console.log('Preview isolation contract passed.');
