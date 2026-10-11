#!/usr/bin/env node
import AxeBuilder from '@axe-core/playwright';
import { chromium, devices } from 'playwright';
import { chmod, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import {
  aggregateObservations,
  aggregatesToCsv,
  COLLECTOR_VERSION,
  isAnalyzableStatus,
  METRIC_DEFINITIONS,
  observationsToCsv,
  publicMetricResults,
  publicStudyMetadata,
  preparePrivateArtifactsPath,
  sha256,
  stableJson,
  validateHomepageUrl,
  validateManifest,
} from './lib/consent-barometer.mjs';
import { canonicalHost, isExcludedHost } from './lib/consent-sampling.mjs';

const REJECT_LABEL = /^(tout\s+)?(refuser|rejeter)(\s+(tout|les témoins|les cookies))?$|^(reject|decline|deny)(\s+all)?$|^(nécessaires|essentiels|necessary|essential)(\s+(seulement|only))$/i;
const CONSENT_CONTROL_LABEL = /accepter|autoriser|allow|accept|agree|refuser|rejeter|reject|decline|deny|continuer sans|gérer|gerer|manage|personnalis|préférences?|preferences?|paramètres?|settings|nécessaires|essentiels|necessary|essential/i;
const BANNER_HINT = /cookie|témoin|consent|confidentialit|vie privée|privacy|données personnelles/i;
const PRIVACY_NAME_HINT = /(?:politique|avis|charte|centre|préférences?).{0,24}(?:confidentialit|vie privée|privacy|témoin|cookie|consent)|(?:confidentialit|vie privée|privacy|témoin|cookie|consent).{0,24}(?:politique|avis|charte|préférences?)/i;
const PRIVACY_PATH_HINT = /privacy|confidentialite|confidentialité|vie-privee|politique[-_/]*(?:cookies?|temoins?)|(?:cookies?|temoins?)[-_/]*(?:policy|politique|preferences?|settings|gestion)|consentement|consent[-_/]*policy/i;
const CHALLENGE_HINT = /verify (?:that )?you are human|checking your browser|attention required|complete (?:the )?captcha|captcha challenge|cloudflare ray id|access denied|vérifiez que vous êtes humain|résolvez le captcha|vérification de sécurité/i;
const CHALLENGE_HEADING = /^(?:verify (?:that )?you are human|checking your browser|attention required|access denied|just a moment|vérifiez que vous êtes humain|vérification de sécurité)[.!…]*$/i;
const BANNER_MARKER = '[data-27pm-consent-banner]';
const REJECT_MARKER = '[data-27pm-reject]';
const VIEWPORT = { width: 390, height: 844 };
const DEVICE_PROFILE = 'Chromium mobile emulation (390 × 844, touch)';
const MOBILE_CONTEXT_OPTIONS = {
  ...devices['Pixel 7'],
  viewport: VIEWPORT,
  screen: VIEWPORT,
  locale: 'fr-CA',
  timezoneId: 'America/Toronto',
  colorScheme: 'light',
};
const execFileAsync = promisify(execFile);
const PUBLIC_OUTPUT_NAMES = ['barometre-consentement.json', 'barometre-consentement-agregats.csv'];

function usage() {
  console.log('Usage: npm run barometer:collect -- --manifest <fichier.json> --out <dossier> [--validate-only] [--limit N | --site-id site-NNN]');
}

export function parseCollectorArgs(argv) {
  const args = { validateOnly: false, limit: null, siteId: null };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--validate-only') args.validateOnly = true;
    else if (token === '--manifest') args.manifest = argv[++index];
    else if (token === '--out') args.out = argv[++index];
    else if (token === '--limit') args.limit = Number(argv[++index]);
    else if (token === '--site-id') args.siteId = argv[++index];
    else if (token === '--help' || token === '-h') args.help = true;
    else throw new Error(`Argument inconnu: ${token}`);
  }
  if (args.help) return args;
  if (!args.manifest) throw new Error('--manifest est requis.');
  if (!args.validateOnly && !args.out) throw new Error('--out est requis sauf avec --validate-only.');
  if (args.limit !== null && (!Number.isInteger(args.limit) || args.limit < 1)) throw new Error('--limit doit être un entier positif.');
  if (args.siteId !== null && !/^(site|fixture|example|exemple)-\d{3,6}$/.test(args.siteId)) throw new Error('--site-id doit être un identifiant pseudonyme valide.');
  if (args.limit !== null && args.siteId !== null) throw new Error('--limit et --site-id sont mutuellement exclusifs.');
  return args;
}

export function isExternalHost(candidate, finalUrl) {
  try {
    const hostname = candidate.includes('://') ? new URL(candidate).hostname : candidate;
    return canonicalHost(hostname) !== canonicalHost(new URL(finalUrl).hostname);
  } catch {
    return false;
  }
}

export function classifyStablePage({ initialUrl, finalUrl, status, contentType, challengeDetected = false }) {
  let initial;
  let final;
  try {
    initial = validateHomepageUrl(initialUrl, 'La page demandée');
    final = validateHomepageUrl(finalUrl, 'La destination finale après stabilisation');
  } catch {
    return { analyzable: false, reason: 'non_homepage_destination' };
  }
  if (isExcludedHost(final.hostname)) return { analyzable: false, reason: 'platform_destination' };
  if (canonicalHost(initial.hostname) !== canonicalHost(final.hostname)) {
    return { analyzable: false, reason: 'cross_host_destination' };
  }
  if (!isAnalyzableStatus(status)) return { analyzable: false, reason: 'http_status' };
  const mime = String(contentType ?? '').split(';', 1)[0].trim().toLowerCase();
  if (!['text/html', 'application/xhtml+xml'].includes(mime)) return { analyzable: false, reason: 'non_html' };
  if (challengeDetected) return { analyzable: false, reason: 'challenge_or_interstitial' };
  return { analyzable: true, reason: null };
}

function sanitizeError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return message.replaceAll(/https?:\/\/[^\s)\]}]+/g, '[url]');
}

export async function storageCounts(page, context) {
  const errors = [];
  let storage = null;
  let cookies = null;
  try {
    const counts = await page.evaluate(() => ({
      local: globalThis.localStorage.length,
      session: globalThis.sessionStorage.length,
    }));
    storage = counts.local + counts.session;
  } catch (error) {
    errors.push(`stockage Web: ${sanitizeError(error)}`);
  }
  try {
    cookies = (await context.cookies()).length;
  } catch (error) {
    errors.push(`témoins: ${sanitizeError(error)}`);
  }
  return {
    cookies,
    storage,
    errors,
  };
}

async function visibleLocators(locator) {
  const matches = [];
  const count = await locator.count();
  for (let index = 0; index < count; index += 1) {
    const candidate = locator.nth(index);
    const visible = await candidate.evaluate((element) => {
      const composedParent = (node) => node.parentElement ?? node.getRootNode()?.host ?? null;
      for (let current = element; current; current = composedParent(current)) {
        const style = globalThis.getComputedStyle(current);
        if (style.display === 'none' || style.visibility !== 'visible' || Number.parseFloat(style.opacity || '1') <= 0.05) return false;
      }
      const rect = element.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return false;
      const style = globalThis.getComputedStyle(element);
      if (style.pointerEvents === 'none') return false;
      const point = { x: Math.max(0, Math.min(globalThis.innerWidth - 1, rect.left + rect.width / 2)), y: Math.max(0, Math.min(globalThis.innerHeight - 1, rect.top + rect.height / 2)) };
      let hit = element.ownerDocument.elementFromPoint(point.x, point.y);
      const containsComposed = (ancestor, node) => {
        for (let current = node; current; current = composedParent(current)) if (current === ancestor) return true;
        return false;
      };
      return !hit || containsComposed(element, hit) || containsComposed(hit, element);
    }).catch(() => false);
    if (visible) matches.push(candidate);
  }
  return matches;
}

async function rejectControlsIn(container) {
  const controls = [];
  for (const role of ['button', 'link']) {
    controls.push(...await visibleLocators(container.getByRole(role, { name: REJECT_LABEL })));
  }
  return controls;
}

async function consentControlsIn(container) {
  const controls = [];
  for (const role of ['button', 'link']) {
    controls.push(...await visibleLocators(container.getByRole(role, { name: CONSENT_CONTROL_LABEL })));
  }
  return controls;
}

async function hasExplicitDialogName(container) {
  return container.evaluate((element) => {
    const ariaLabel = element.getAttribute('aria-label')?.trim();
    if (ariaLabel) return true;
    const labelledBy = element.getAttribute('aria-labelledby')?.trim();
    if (labelledBy) {
      const root = element.getRootNode();
      const label = labelledBy
        .split(/\s+/)
        .map((id) => root.getElementById?.(id)?.textContent?.trim() ?? '')
        .filter(Boolean)
        .join(' ');
      if (label) return true;
    }
    return Boolean(element.getAttribute('title')?.trim());
  });
}

export async function findBanner(page, { mark = true } = {}) {
  const containers = page.locator([
    'dialog',
    '[role="dialog"]',
    '[role="alertdialog"]',
    '[aria-modal="true"]',
    '[class*="cookie" i]',
    '[id*="cookie" i]',
    '[class*="consent" i]',
    '[id*="consent" i]',
  ].join(', '));
  const ranked = [];
  for (const candidate of await visibleLocators(containers)) {
    const text = (await candidate.textContent().catch(() => '')) ?? '';
    const semanticAttributes = await candidate.evaluate((element) => [
      element.id,
      element.className,
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
    ].filter(Boolean).join(' ')).catch(() => '');
    const scopedRejectControls = await rejectControlsIn(candidate);
    const scopedConsentControls = await consentControlsIn(candidate);
    if (!BANNER_HINT.test(`${text} ${semanticAttributes}`)) continue;
    const details = await candidate.evaluate((element) => {
      const style = globalThis.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      const role = element.getAttribute('role')?.toLowerCase() ?? '';
      const implicitDialog = element.tagName.toLowerCase() === 'dialog';
      let depth = 0;
      for (let current = element; current; current = current.parentElement ?? current.getRootNode()?.host ?? null) depth += 1;
      return {
        role,
        implicitDialog,
        ariaModal: element.getAttribute('aria-modal') === 'true',
        position: style.position,
        zIndex: Number.parseInt(style.zIndex, 10) || 0,
        inStaticRegion: Boolean(element.closest('footer, header, main, article')),
        area: rect.width * rect.height,
        viewportShare: (rect.width * rect.height) / Math.max(1, globalThis.innerWidth * globalThis.innerHeight),
        depth,
      };
    });
    const modalSignal = details.implicitDialog || ['dialog', 'alertdialog'].includes(details.role) || details.ariaModal;
    const floatingSignal = ['fixed', 'sticky'].includes(details.position);
    const overlaySignal = details.position === 'absolute' && details.viewportShare >= 0.2 && details.zIndex > 0;
    const controlSignal = scopedConsentControls.length > 0;
    if (details.inStaticRegion && !modalSignal && !floatingSignal && !overlaySignal) continue;
    if (!modalSignal && !floatingSignal && !overlaySignal && !controlSignal) continue;
    let score = 0;
    if (details.implicitDialog || ['dialog', 'alertdialog'].includes(details.role)) score += 100;
    if (details.ariaModal) score += 80;
    if (['fixed', 'sticky'].includes(details.position)) score += 50;
    if (details.zIndex > 0) score += Math.min(20, Math.log10(details.zIndex + 1) * 5);
    if (scopedConsentControls.length > 0) score += 20;
    if (scopedRejectControls.length > 0) score += 30;
    score += details.depth * 0.25;
    score -= Math.min(20, details.area / Math.max(1, VIEWPORT.width * VIEWPORT.height) * 10);
    ranked.push({ candidate, rejectControls: scopedRejectControls, details, score });
  }
  ranked.sort((left, right) => right.score - left.score || right.details.depth - left.details.depth || left.details.area - right.details.area);
  const selected = ranked[0];
  const banner = selected?.candidate ?? null;
  const rejectControls = selected?.rejectControls ?? [];
  if (!banner) return { detected: false, rejectCount: 0 };

  let axeSelector;
  if (mark) {
    const shadowHostSelectors = await banner.evaluate((element) => {
      element.setAttribute('data-27pm-consent-banner', '');
      const hosts = [];
      let root = element.getRootNode();
      while (root instanceof globalThis.ShadowRoot) {
        hosts.unshift(root.host);
        root = root.host.getRootNode();
      }
      return hosts.map((host, index) => {
        host.setAttribute('data-27pm-consent-shadow-host', String(index));
        return `[data-27pm-consent-shadow-host="${index}"]`;
      });
    });
    axeSelector = shadowHostSelectors.length > 0
      ? { fromShadowDom: [...shadowHostSelectors, BANNER_MARKER] }
      : BANNER_MARKER;
    if (rejectControls.length === 1) {
      await rejectControls[0].evaluate((element) => element.setAttribute('data-27pm-reject', ''));
    }
  }
  const role = (await banner.getAttribute('role'))?.toLowerCase() ?? '';
  const tagName = await banner.evaluate((element) => element.tagName.toLowerCase());
  const dialogRole = tagName === 'dialog' || role === 'dialog' || role === 'alertdialog';
  const dialogHasName = dialogRole ? await hasExplicitDialogName(banner) : null;
  const privacyLink = await banner.locator('a[href]').evaluateAll((links, patterns) => links.some((link) => {
    const style = globalThis.getComputedStyle(link);
    const rect = link.getBoundingClientRect();
    if (style.display === 'none' || style.visibility !== 'visible' || Number.parseFloat(style.opacity || '1') <= 0.05 || rect.width <= 0 || rect.height <= 0) return false;
    const name = [link.getAttribute('aria-label'), link.textContent, link.getAttribute('title')].filter(Boolean).join(' ').trim();
    if (new RegExp(patterns.name, 'i').test(name)) return true;
    try {
      const url = new URL(link.getAttribute('href') ?? '', link.ownerDocument.baseURI);
      const path = `${url.pathname}${url.search}`;
      return new RegExp(patterns.path, 'i').test(path);
    } catch {
      return false;
    }
  }), { name: PRIVACY_NAME_HINT.source, path: PRIVACY_PATH_HINT.source });
  const overflowPx = await banner.evaluate((element) => {
    let maximum = Math.max(0, element.scrollWidth - element.clientWidth);
    const visit = (root) => {
      for (const child of root.querySelectorAll('*')) {
        const rect = child.getBoundingClientRect();
        maximum = Math.max(maximum, rect.right - globalThis.innerWidth, -rect.left, child.scrollWidth - child.clientWidth);
        if (child.shadowRoot) visit(child.shadowRoot);
      }
    };
    const rect = element.getBoundingClientRect();
    maximum = Math.max(maximum, rect.right - globalThis.innerWidth, -rect.left);
    visit(element);
    return Math.max(0, Math.round(maximum));
  });
  return {
    detected: true,
    rejectCount: rejectControls.length,
    dialogRole,
    dialogHasName,
    privacyLink,
    overflowPx,
    axeSelector,
    bannerSelector: BANNER_MARKER,
  };
}

export async function keyboardReject(page, {
  detectBannerAfterAction = findBanner,
  afterActionDelayMs = 1500,
  onBeforeActivation = () => {},
  bannerSelector = BANNER_MARKER,
} = {}) {
  const focusSentinel = '[data-27pm-focus-start]';
  const startReady = await page.evaluate((selector) => {
    globalThis.document.querySelectorAll(selector).forEach((element) => element.remove());
    if (!globalThis.document.body) return false;
    const sentinel = globalThis.document.createElement('span');
    sentinel.setAttribute('data-27pm-focus-start', '');
    sentinel.tabIndex = 0;
    sentinel.setAttribute('aria-hidden', 'true');
    Object.assign(sentinel.style, {
      position: 'fixed',
      width: '1px',
      height: '1px',
      opacity: '0',
      pointerEvents: 'none',
      inset: '0 auto auto 0',
    });
    globalThis.document.body.prepend(sentinel);
    sentinel.focus({ preventScroll: true });
    return globalThis.document.activeElement === sentinel;
  }, focusSentinel).catch(() => false);
  if (!startReady) {
    return { steps: null, focusIndicatorHeuristic: null, activated: false, actionResult: 'indeterminate', errors: ['point de départ clavier indisponible'] };
  }
  const cleanupSentinel = () => page.locator(focusSentinel).evaluateAll((elements) => elements.forEach((element) => element.remove())).catch(() => {});
  const target = page.locator(REJECT_MARKER);
  const baseline = await target.evaluate((element) => {
    const style = globalThis.getComputedStyle(element);
    return Object.fromEntries(['outlineStyle', 'outlineWidth', 'outlineColor', 'boxShadow', 'backgroundColor', 'borderColor', 'color', 'transform'].map((key) => [key, style[key]]));
  }).catch(() => null);
  try {
    for (let steps = 1; steps <= 50; steps += 1) {
      await page.keyboard.press('Tab');
      const state = await target.evaluate((element, baselineStyle) => {
      let active = element.ownerDocument.activeElement;
      while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
      if (!active) return { reached: false, focusIndicatorHeuristic: null };

      let current = active;
      let reached = false;
      while (current) {
        if (current === element) {
          reached = true;
          break;
        }
        current = current.parentElement ?? current.getRootNode()?.host ?? null;
      }
      if (!reached) return { reached: false, focusIndicatorHeuristic: null };
      const style = globalThis.getComputedStyle(active);
      const transparent = (value) => !value || value === 'transparent' || /rgba\([^)]*,\s*0(?:\.0+)?\s*\)/i.test(value);
      const visible = style.display !== 'none' && style.visibility === 'visible' && Number.parseFloat(style.opacity || '1') > 0.05;
      const outlineVisible = style.outlineStyle !== 'none' && parseFloat(style.outlineWidth || '0') > 0 && !transparent(style.outlineColor);
      const shadowVisible = Boolean(style.boxShadow && style.boxShadow !== 'none' && !transparent(style.boxShadow));
      const changed = ['backgroundColor', 'borderColor', 'color', 'transform']
        .some((key) => style[key] !== baselineStyle?.[key] && (key === 'transform' ? style[key] !== 'none' : !transparent(style[key])));
      return { reached: true, focusIndicatorHeuristic: visible && active.matches(':focus-visible') && (outlineVisible || shadowVisible || changed) };
      }, baseline).catch(() => ({ reached: false, focusIndicatorHeuristic: null }));
      if (!state.reached) continue;
      const beforeUrl = page.url();
      let navigated = false;
      const mainFrame = page.mainFrame();
      const navigationListener = (frame) => { if (frame === mainFrame) navigated = true; };
      page.on('framenavigated', navigationListener);
      try {
        await onBeforeActivation();
        await cleanupSentinel();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(afterActionDelayMs);
      } catch (error) {
        page.off('framenavigated', navigationListener);
        return { steps, focusIndicatorHeuristic: state.focusIndicatorHeuristic, activated: false, actionResult: 'indeterminate', errors: [`activation clavier: ${sanitizeError(error)}`] };
      }
      page.off('framenavigated', navigationListener);
      if (navigated || page.url() !== beforeUrl) {
        return { steps, focusIndicatorHeuristic: state.focusIndicatorHeuristic, activated: true, actionResult: 'navigated', errors: [] };
      }
      try {
        const exactBanner = page.locator(bannerSelector);
        const exactBannerVisible = await exactBanner.count() > 0 && await exactBanner.evaluate((element) => {
          const composedParent = (node) => node.parentElement ?? node.getRootNode()?.host ?? null;
          for (let current = element; current; current = composedParent(current)) {
            const style = globalThis.getComputedStyle(current);
            if (style.display === 'none' || style.visibility !== 'visible' || Number.parseFloat(style.opacity || '1') <= 0.05 || style.pointerEvents === 'none') return false;
          }
          const rect = element.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0 || rect.right <= 0 || rect.bottom <= 0 || rect.left >= globalThis.innerWidth || rect.top >= globalThis.innerHeight) return false;
          const x = Math.max(0, Math.min(globalThis.innerWidth - 1, rect.left + rect.width / 2));
          const y = Math.max(0, Math.min(globalThis.innerHeight - 1, rect.top + rect.height / 2));
          const hit = element.ownerDocument.elementFromPoint(x, y);
          const containsComposed = (ancestor, node) => {
            for (let current = node; current; current = composedParent(current)) if (current === ancestor) return true;
            return false;
          };
          return !hit || containsComposed(element, hit) || containsComposed(hit, element);
        }).catch(() => false);
        if (exactBannerVisible) {
          return { steps, focusIndicatorHeuristic: state.focusIndicatorHeuristic, activated: true, actionResult: 'failed', errors: [] };
        }
        const after = await detectBannerAfterAction(page, { mark: false });
        return { steps, focusIndicatorHeuristic: state.focusIndicatorHeuristic, activated: true, actionResult: after.detected ? 'failed' : 'closed', errors: [] };
      } catch (error) {
        return { steps, focusIndicatorHeuristic: state.focusIndicatorHeuristic, activated: true, actionResult: 'indeterminate', errors: [`visibilité après refus: ${sanitizeError(error)}`] };
      }
    }
    return { steps: null, focusIndicatorHeuristic: null, activated: false, actionResult: 'indeterminate', errors: [] };
  } finally {
    await cleanupSentinel();
  }
}

export async function detectChallenge(page) {
  return page.evaluate(({ challengeSource, headingSource }) => {
    const roots = [globalThis.document];
    for (let index = 0; index < roots.length; index += 1) {
      for (const element of roots[index].querySelectorAll('*')) {
        if (element.shadowRoot) roots.push(element.shadowRoot);
      }
    }
    const all = (selector) => roots.flatMap((root) => [...root.querySelectorAll(selector)]);
    const composedParent = (node) => node.parentElement ?? node.getRootNode()?.host ?? null;
    const visible = (element) => {
      for (let current = element; current; current = composedParent(current)) {
        const style = globalThis.getComputedStyle(current);
        if (style.display === 'none' || style.visibility !== 'visible' || Number.parseFloat(style.opacity || '1') <= 0.05) return false;
      }
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const bodyText = roots
      .map((root) => root instanceof globalThis.Document ? root.body?.innerText : root.textContent)
      .filter(Boolean)
      .join(' ')
      .trim();
    const visibleExplicitChallenge = all([
      'iframe[src*="captcha" i]',
      'iframe[src*="challenge" i]',
      '#challenge-form',
      'form[action*="challenge" i]',
      '.g-recaptcha',
      '.h-captcha',
      '.hcaptcha',
    ].join(', ')).some((element) => {
      const rect = element.getBoundingClientRect();
      const viewportShare = (rect.width * rect.height) / Math.max(1, globalThis.innerWidth * globalThis.innerHeight);
      return visible(element) && viewportShare >= 0.15;
    });
    if (visibleExplicitChallenge) return true;

    const exactHeading = all('h1, h2, [role="heading"]').some((element) => {
      return visible(element) && new RegExp(headingSource, 'i').test(element.textContent?.trim() ?? '');
    });
    const exactTitle = new RegExp(headingSource, 'i').test(globalThis.document.title.trim());
    const challengeLanguage = new RegExp(challengeSource, 'i').test(bodyText.slice(0, 5000));
    const editorialStructure = all('article, [itemtype*="Article" i], meta[property="og:type"][content="article" i]').length > 0;
    return challengeLanguage && (exactHeading || exactTitle) && bodyText.length <= 1500 && !editorialStructure;
  }, { challengeSource: CHALLENGE_HINT.source, headingSource: CHALLENGE_HEADING.source }).catch(() => false);
}

export async function collectSite(browser, site, dependencies = {}) {
  if (site.eligibility === 'excluded') {
    return {
      site_id: site.site_id,
      region: site.region ?? null,
      sector: site.sector ?? null,
      observed_at_utc: null,
      observation_end_utc: null,
      eligibility: 'excluded',
      http_responded: false,
      analyzable: false,
      analysis_reason: 'excluded',
      exclusion_reason: site.exclusion_reason,
      errors: [],
    };
  }

  const readStorageCounts = dependencies.readStorageCounts ?? storageCounts;
  const detectBanner = dependencies.detectBanner ?? findBanner;
  const rejectByKeyboard = dependencies.rejectByKeyboard ?? keyboardReject;
  const recordPrivateEvidence = dependencies.recordPrivateEvidence ?? (() => {});
  const analyzeBanner = dependencies.analyzeBanner ?? (async (page, banner) => {
    if (!banner.axeSelector) throw new Error('sélecteur de bannière indisponible');
    return new AxeBuilder({ page }).include(banner.axeSelector).analyze();
  });
  const context = await browser.newContext(dependencies.contextOptions ?? MOBILE_CONTEXT_OPTIONS);
  const page = await context.newPage();
  let latestMainDocumentResponse = null;
  const rememberMainDocumentResponse = (response) => {
    const request = response.request();
    if (request.resourceType() === 'document' && request.frame() === page.mainFrame()) {
      latestMainDocumentResponse = response;
    }
  };
  page.on('response', rememberMainDocumentResponse);
  let stabilityTracking = false;
  let stableAnalysisUrl = null;
  let preActivationNavigation = false;
  let activationStarted = false;
  let beforeCaptured = false;
  const rememberAnalysisNavigation = (frame) => {
    if (stabilityTracking && !activationStarted && frame === page.mainFrame()) preActivationNavigation = true;
  };
  page.on('framenavigated', rememberAnalysisNavigation);
  const beforeHosts = new Set();
  const afterHosts = new Set();
  let phase = 'before';
  page.on('request', (request) => {
    try {
      const host = canonicalHost(new URL(request.url()).hostname);
      (phase === 'before' ? beforeHosts : afterHosts).add(host);
    } catch {
      // Non-HTTP browser URL.
    }
  });

  const observation = {
    site_id: site.site_id,
    region: site.region ?? null,
    sector: site.sector ?? null,
    observed_at_utc: new Date().toISOString(),
    observation_end_utc: null,
    eligibility: 'included',
    exclusion_reason: null,
    http_responded: false,
    analyzable: false,
    analysis_reason: 'not_collected',
    final_status: null,
    device_profile: DEVICE_PROFILE,
    user_agent: null,
    touch_points: null,
    banner_detected: 'indeterminate',
    reject_first_layer: 'indeterminate',
    keyboard_reject_steps: null,
    dialog_role_present: null,
    dialog_accessible_name: 'indeterminate',
    focus_indicator_heuristic: 'indeterminate',
    privacy_link_in_banner: 'indeterminate',
    mobile_overflow_px: null,
    axe_rule_count_banner: null,
    axe_rule_ids_banner: [],
    external_hosts_before_choice_count: null,
    cookies_before_choice_count: null,
    document_storage_keys_before_choice_count: null,
    reject_action_result: 'indeterminate',
    reject_action_closed: 'indeterminate',
    external_hosts_after_reject_count: null,
    cookies_after_reject_count: null,
    document_storage_keys_after_reject_count: null,
    errors: [],
  };

  const markPageChangedDuringAnalysis = () => {
    observation.analyzable = false;
    observation.analysis_reason = 'page_changed_during_analysis';
    observation.final_status = null;
    Object.assign(observation, {
      banner_detected: 'indeterminate',
      reject_first_layer: 'indeterminate',
      keyboard_reject_steps: null,
      dialog_role_present: null,
      dialog_accessible_name: 'indeterminate',
      focus_indicator_heuristic: 'indeterminate',
      privacy_link_in_banner: 'indeterminate',
      mobile_overflow_px: null,
      axe_rule_count_banner: null,
      axe_rule_ids_banner: [],
      external_hosts_before_choice_count: null,
      cookies_before_choice_count: null,
      document_storage_keys_before_choice_count: null,
      reject_action_result: 'indeterminate',
      reject_action_closed: 'indeterminate',
      external_hosts_after_reject_count: null,
      cookies_after_reject_count: null,
      document_storage_keys_after_reject_count: null,
    });
    observation.errors = ['observation indéterminée: page_changed_during_analysis'];
  };

  const captureBeforeChoice = async () => {
    if (preActivationNavigation || !stableAnalysisUrl || page.url() !== stableAnalysisUrl) {
      markPageChangedDuringAnalysis();
      return false;
    }
    if (beforeCaptured) return true;
    const before = await readStorageCounts(page, context);
    if (preActivationNavigation || page.url() !== stableAnalysisUrl) {
      markPageChangedDuringAnalysis();
      return false;
    }
    observation.cookies_before_choice_count = before.cookies;
    observation.document_storage_keys_before_choice_count = before.storage;
    observation.errors.push(...(before.errors ?? []));
    observation.external_hosts_before_choice_count = [...beforeHosts].filter((host) => isExternalHost(host, stableAnalysisUrl)).length;
    beforeCaptured = true;
    return true;
  };

  try {
    const initialResponse = await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(dependencies.initialWaitMs ?? 2500);
    const finalUrl = page.url();
    const finalDocumentResponse = latestMainDocumentResponse ?? initialResponse;
    const responseStatus = finalDocumentResponse?.status() ?? null;
    const contentType = finalDocumentResponse?.headers()['content-type'] ?? null;
    const challengeDetected = await (dependencies.detectChallenge ?? detectChallenge)(page);
    const redirects = [];
    for (let request = finalDocumentResponse?.request() ?? null; request; request = request.redirectedFrom()) redirects.unshift(request.url());
    recordPrivateEvidence({
      site_id: site.site_id,
      requested_url: site.url,
      destination_url: finalUrl,
      document_response_url: finalDocumentResponse?.url() ?? null,
      redirect_chain: redirects,
      status: responseStatus,
      content_type: contentType,
      challenge_detected: challengeDetected,
    });
    const stable = classifyStablePage({ initialUrl: site.url, finalUrl, status: responseStatus, contentType, challengeDetected });
    observation.http_responded = responseStatus !== null;
    observation.analysis_reason = stable.reason;
    if (stable.reason === 'http_status') observation.final_status = responseStatus;
    if (!stable.analyzable) {
      observation.errors.push(`observation indéterminée: ${stable.reason}`);
      return observation;
    }
    observation.final_status = responseStatus;
    observation.analyzable = true;
    observation.analysis_reason = null;
    stableAnalysisUrl = finalUrl;
    stabilityTracking = true;
    const deviceState = await page.evaluate(() => ({
      userAgent: globalThis.navigator.userAgent,
      touchPoints: globalThis.navigator.maxTouchPoints,
    }));
    observation.user_agent = deviceState.userAgent;
    observation.touch_points = deviceState.touchPoints;

    const banner = await detectBanner(page);
    observation.banner_detected = banner.detected ? 'yes' : 'no';
    if (!banner.detected) {
      observation.reject_first_layer = 'not_applicable';
      observation.dialog_accessible_name = 'not_applicable';
      observation.focus_indicator_heuristic = 'not_applicable';
      observation.privacy_link_in_banner = 'not_applicable';
      observation.reject_action_result = 'not_applicable';
      observation.reject_action_closed = 'not_applicable';
      await captureBeforeChoice();
      return observation;
    }

    observation.reject_first_layer = banner.rejectCount === 1 ? 'yes' : banner.rejectCount === 0 ? 'no' : 'indeterminate';
    observation.dialog_role_present = banner.dialogRole;
    observation.dialog_accessible_name = banner.dialogRole ? (banner.dialogHasName ? 'yes' : 'no') : 'not_applicable';
    observation.privacy_link_in_banner = banner.privacyLink ? 'yes' : 'no';
    observation.mobile_overflow_px = banner.overflowPx;
    try {
      const axe = await analyzeBanner(page, banner);
      observation.axe_rule_ids_banner = axe.violations.map((violation) => violation.id).sort();
      observation.axe_rule_count_banner = observation.axe_rule_ids_banner.length;
    } catch (error) {
      observation.errors.push(`Axe: ${sanitizeError(error)}`);
    }

    if (banner.rejectCount === 1) {
      const rejected = await rejectByKeyboard(page, {
        detectBannerAfterAction: detectBanner,
        afterActionDelayMs: dependencies.afterActionDelayMs ?? 1500,
        bannerSelector: banner.bannerSelector,
        onBeforeActivation: async () => {
          if (!await captureBeforeChoice()) throw new Error('page changed during analysis');
          activationStarted = true;
          phase = 'after';
        },
      });
      if (!observation.analyzable) return observation;
      observation.keyboard_reject_steps = rejected.steps;
      observation.focus_indicator_heuristic = rejected.focusIndicatorHeuristic === null ? 'indeterminate' : rejected.focusIndicatorHeuristic ? 'yes' : 'no';
      observation.reject_action_result = rejected.actionResult;
      observation.reject_action_closed = rejected.actionResult === 'closed' ? 'yes' : rejected.actionResult === 'failed' ? 'no' : 'indeterminate';
      observation.errors.push(...(rejected.errors ?? []));
      if (rejected.activated && rejected.actionResult !== 'navigated') {
        observation.external_hosts_after_reject_count = [...afterHosts].filter((host) => isExternalHost(host, finalUrl)).length;
        const after = await readStorageCounts(page, context);
        observation.cookies_after_reject_count = after.cookies;
        observation.document_storage_keys_after_reject_count = after.storage;
        observation.errors.push(...(after.errors ?? []));
      }
    }
    if (!beforeCaptured) await captureBeforeChoice();
  } catch (error) {
    observation.errors.push(sanitizeError(error));
  } finally {
    observation.observation_end_utc = new Date().toISOString();
    page.off('response', rememberMainDocumentResponse);
    page.off('framenavigated', rememberAnalysisNavigation);
    await context.close();
  }
  return observation;
}

export async function writeCollectorOutputs({ outDir, study, observations, aggregates, navigationLedger, privateRun }) {
  const targetDir = resolve(outDir);
  const privateDir = resolve(targetDir, 'private');
  const publicMetrics = publicMetricResults(METRIC_DEFINITIONS, aggregates);
  const publicOutput = {
    study,
    metric_definitions: publicMetrics.metric_definitions,
    aggregates: publicMetrics.aggregates,
  };
  await ensurePrivateDirectory(targetDir);
  await ensurePrivateDirectory(privateDir);
  const json = stableJson(publicOutput);
  const observationsCsv = observationsToCsv(observations);
  const aggregatesCsv = aggregatesToCsv(publicMetrics.aggregates);
  await rm(resolve(targetDir, 'barometre-consentement-observations.csv'), { force: true });
  await writePrivateFile(resolve(targetDir, 'barometre-consentement.json'), json);
  await writePrivateFile(resolve(targetDir, 'barometre-consentement-agregats.csv'), aggregatesCsv);
  await writePrivateFile(resolve(targetDir, 'SHA256SUMS'), `${sha256(json)}  ${PUBLIC_OUTPUT_NAMES[0]}\n${sha256(aggregatesCsv)}  ${PUBLIC_OUTPUT_NAMES[1]}\n`);
  await writePrivateFile(resolve(privateDir, 'run.json'), stableJson(privateRun));
  await writePrivateFile(resolve(privateDir, 'results.json'), stableJson({ metric_definitions: METRIC_DEFINITIONS, observations, aggregates }));
  await writePrivateFile(resolve(privateDir, 'observations.csv'), observationsCsv);
  await writePrivateFile(resolve(privateDir, 'navigation-ledger.json'), stableJson({ entries: navigationLedger }));
}

async function ensurePrivateDirectory(directory) {
  await mkdir(directory, { recursive: true, mode: 0o700 });
  if (process.platform === 'win32') return;
  const details = await stat(directory);
  if ((details.mode & 0o077) !== 0) {
    throw new Error(`Le dossier d’artefacts privés doit avoir les permissions 0700: ${directory}`);
  }
}

async function writePrivateFile(path, contents) {
  if (process.platform !== 'win32') {
    await chmod(path, 0o600).catch((error) => {
      if (error?.code !== 'ENOENT') throw error;
    });
  }
  await writeFile(path, contents, { mode: 0o600 });
  if (process.platform !== 'win32') await chmod(path, 0o600);
}

async function main() {
  const runStartedAt = new Date().toISOString();
  const args = parseCollectorArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const manifestPath = resolve(args.manifest);
  const manifestSource = await readFile(manifestPath, 'utf8');
  const manifest = validateManifest(JSON.parse(manifestSource));
  console.log(`Manifeste valide: ${manifest.sites.length} site(s), schéma ${manifest.schema_version}.`);
  if (args.validateOnly) return;
  const outDir = await preparePrivateArtifactsPath(args.out, { kind: 'directory' });

  let selectedSites;
  if (args.siteId) {
    const selected = manifest.sites.find((site) => site.site_id === args.siteId);
    if (!selected) throw new Error(`--site-id ne correspond à aucun identifiant du manifeste: ${args.siteId}`);
    selectedSites = [selected];
  } else {
    selectedSites = args.limit ? manifest.sites.slice(0, args.limit) : manifest.sites;
  }
  const browser = await chromium.launch({ headless: true });
  const browserVersion = browser.version();
  const gitStatus = await execFileAsync('git', ['status', '--porcelain', '--untracked-files=all']).then(({ stdout }) => stdout).catch(() => 'unknown');
  const gitDirty = gitStatus === 'unknown' || gitStatus.trim().length > 0;
  const gitSha = gitDirty ? null : await execFileAsync('git', ['rev-parse', 'HEAD']).then(({ stdout }) => stdout.trim()).catch(() => null);
  const packageLockPath = resolve('package-lock.json');
  const packageLockSource = await readFile(packageLockPath, 'utf8');
  const packageLock = JSON.parse(packageLockSource);
  const playwrightVersion = packageLock.packages?.['node_modules/playwright']?.version
    ?? packageLock.packages?.['node_modules/@playwright/test']?.version
    ?? null;
  const libraryNames = (await readdir(resolve('scripts/lib'))).filter((name) => /^consent-.*\.mjs$/.test(name)).sort();
  const sourceBundleParts = [];
  for (const path of ['scripts/collect-consent-barometer.mjs', ...libraryNames.map((name) => `scripts/lib/${name}`), 'package-lock.json']) {
    sourceBundleParts.push(`${path}\0${await readFile(resolve(path), 'utf8')}`);
  }
  const sourceBundleSha256 = sha256(sourceBundleParts.join('\0'));
  const observations = [];
  const navigationLedger = [];
  try {
    for (const [index, site] of selectedSites.entries()) {
      console.log(`[${index + 1}/${selectedSites.length}] ${site.site_id}`);
      observations.push(await collectSite(browser, site, {
        recordPrivateEvidence: (entry) => navigationLedger.push(entry),
      }));
    }
  } finally {
    await browser.close();
  }
  const runEndedAt = new Date().toISOString();

  const aggregates = aggregateObservations(observations);
  const publicStudy = publicStudyMetadata(manifest.study);
  const study = {
      ...publicStudy,
      schema_version: manifest.schema_version,
      collection_mode: args.siteId ? 'targeted_recheck' : args.limit ? 'technical_pilot' : 'full_sample',
      manifest_n: manifest.sites.length,
      n_sampled: selectedSites.length,
      n_eligible: observations.filter((item) => item.eligibility === 'included').length,
      n_http_responded: observations.filter((item) => item.eligibility === 'included' && item.http_responded === true).length,
      n_analyzable: observations.filter((item) => item.eligibility === 'included' && item.analyzable === true).length,
      observation_start: runStartedAt,
      observation_end: runEndedAt,
      minimum_public_breakdown_n: 5,
      collector: {
        name: '27PM consent barometer collector',
        version: COLLECTOR_VERSION,
        source_bundle_sha256: sourceBundleSha256,
      },
      sample_manifest_sha256: sha256(manifestSource),
      limitations: [
        'Observation ponctuelle de la page d’accueil dans un navigateur neuf; le comportement peut varier selon le moment, la région ou la personnalisation.',
        'Un hôte externe observé n’est pas nécessairement un tiers ni un traceur et aucune finalité n’est attribuée.',
        'L’absence de requête, de témoin ou de stockage observé ne prouve pas l’absence de suivi.',
        'Les résultats ne constituent ni un avis juridique ni un verdict de conformité.',
      ],
  };
  const privateRun = {
    run_started_at: runStartedAt,
    run_ended_at: runEndedAt,
    counts: {
      sampled: selectedSites.length,
      http_responded: observations.filter((item) => item.http_responded === true).length,
      analyzable: observations.filter((item) => item.analyzable === true).length,
    },
    provenance: {
      source_bundle_sha256: sourceBundleSha256,
      git_dirty: gitDirty,
      git_sha: gitSha,
      engine: 'chromium',
      engine_version: browserVersion,
      playwright_version: playwrightVersion,
      node_version: process.version,
      headless: true,
      os: `${process.platform} ${process.arch}`,
      device_profile: DEVICE_PROFILE,
      user_agent: observations.find((item) => item.user_agent)?.user_agent ?? MOBILE_CONTEXT_OPTIONS.userAgent,
      operator_declared_network_region: process.env.BAROMETER_NETWORK_REGION ?? 'not_verified',
      operator_declared_network_edge: process.env.BAROMETER_NETWORK_EDGE ?? 'not_verified',
      network_note: 'Valeurs déclarées par l’opérateur; elles ne prouvent pas le trajet de chaque requête. Aucune adresse IP conservée.',
    },
  };
  await writeCollectorOutputs({ outDir, study, observations, aggregates, navigationLedger, privateRun });
  console.log(`Résultats écrits dans ${outDir}.`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : null;
if (invokedPath === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    usage();
    process.exitCode = 1;
  });
}
