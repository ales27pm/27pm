import contentRoutes from './content-routes.json';

export const ANALYTICS_MEASUREMENT_ID = 'G-S0SKT2CTV0';
export const ANALYTICS_CONSENT_STORAGE_KEY = '27pm.analytics-consent.v1';
export const ANALYTICS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 60;
export const GOOGLE_TAG_SOURCE =
  `https://www.googletagmanager.com/gtag/js?id=${ANALYTICS_MEASUREMENT_ID}`;

export type AnalyticsConsent = 'granted' | 'denied';
export type AnalyticsCommand = unknown[];

export interface AnalyticsPageContext {
  pageLocation: string;
  pageReferrer: string;
}

export interface AnalyticsRuntime {
  hostname: string;
  protocol: string;
  pageLocation: string;
  pageReferrer: string;
  hasGoogleTag: () => boolean;
  queue: (command: AnalyticsCommand) => void;
  appendGoogleTag: (source: string) => void;
}

export interface AnalyticsConsentOptions {
  enabled?: boolean;
}

export interface AnalyticsStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

declare global {
  interface Window {
    dataLayer?: Array<IArguments | unknown[]>;
    gtag?: (...args: unknown[]) => void;
  }
}

const deniedConsent = () => ({
  ad_storage: 'denied',
  analytics_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
});

const analyticsOnlyConsent = () => ({
  ad_storage: 'denied',
  analytics_storage: 'granted',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
});

export function parseAnalyticsConsent(value: string | null): AnalyticsConsent | null {
  return value === 'granted' || value === 'denied' ? value : null;
}

export function persistAnalyticsConsent(
  storage: AnalyticsStorage,
  consent: AnalyticsConsent,
): boolean {
  try {
    storage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, consent);
    return storage.getItem(ANALYTICS_CONSENT_STORAGE_KEY) === consent;
  } catch {
    return false;
  }
}

export function removePersistedAnalyticsConsent(storage: AnalyticsStorage): boolean {
  try {
    storage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
    return parseAnalyticsConsent(storage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)) !== 'granted';
  } catch {
    return false;
  }
}

export function isAnalyticsCookieName(name: string): boolean {
  return /^_ga(?:_|$)/.test(name);
}

const canonicalAnalyticsPaths = new Set(['/', '/confidentialite/', '/404.html', ...contentRoutes]);

function parseAnalyticsUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

export function sanitizeAnalyticsPageLocation(value: string): string {
  const url = parseAnalyticsUrl(value);
  if (!url) return '';
  const pathname = canonicalAnalyticsPaths.has(url.pathname) ? url.pathname : '/404.html';
  return `${url.origin}${pathname}`;
}

export function sanitizeAnalyticsReferrer(value: string): string {
  return parseAnalyticsUrl(value)?.origin ?? '';
}

export function buildAnalyticsCommands(
  now = new Date(),
  pageContext: AnalyticsPageContext = {
    pageLocation: 'https://27pm.org/',
    pageReferrer: '',
  },
): AnalyticsCommand[] {
  return [
    ['consent', 'default', deniedConsent()],
    ['consent', 'update', analyticsOnlyConsent()],
    ['set', 'ads_data_redaction', true],
    ['js', now],
    [
      'config',
      ANALYTICS_MEASUREMENT_ID,
      {
        allow_ad_personalization_signals: false,
        allow_google_signals: false,
        cookie_expires: ANALYTICS_COOKIE_MAX_AGE_SECONDS,
        cookie_update: false,
        page_location: sanitizeAnalyticsPageLocation(pageContext.pageLocation),
        page_referrer: sanitizeAnalyticsReferrer(pageContext.pageReferrer),
        send_page_view: true,
      },
    ],
  ];
}

export function loadGoogleAnalytics(runtime: AnalyticsRuntime, now = new Date()): boolean {
  if (
    runtime.hostname !== '27pm.org'
    || runtime.protocol !== 'https:'
    || runtime.hasGoogleTag()
  ) {
    return false;
  }

  for (const command of buildAnalyticsCommands(now, {
    pageLocation: runtime.pageLocation,
    pageReferrer: runtime.pageReferrer,
  })) runtime.queue(command);
  runtime.appendGoogleTag(GOOGLE_TAG_SOURCE);
  return true;
}

export function createGtagQueue(
  dataLayer: Array<IArguments | unknown[]>,
): (...args: unknown[]) => void {
  return function gtag() {
    // gtag.js consumes the Arguments object used by Google's official wrapper.
    // eslint-disable-next-line prefer-rest-params
    dataLayer.push(arguments);
  };
}

function ensureGtag(): (...args: unknown[]) => void {
  window.dataLayer ??= [];
  window.gtag ??= createGtagQueue(window.dataLayer);
  return window.gtag;
}

function browserRuntime(): AnalyticsRuntime {
  return {
    hostname: window.location.hostname,
    protocol: window.location.protocol,
    pageLocation: window.location.href,
    pageReferrer: document.referrer,
    hasGoogleTag: () => document.querySelector('script[data-google-tag="analytics"]') !== null,
    queue: (command) => ensureGtag()(...command),
    appendGoogleTag: (source) => {
      const script = document.createElement('script');
      script.async = true;
      script.src = source;
      script.dataset.googleTag = 'analytics';
      document.head.append(script);
    },
  };
}

function readStoredConsent(): AnalyticsConsent | null {
  try {
    return parseAnalyticsConsent(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY));
  } catch {
    return null;
  }
}

function storeConsent(consent: AnalyticsConsent): boolean {
  try {
    return persistAnalyticsConsent(window.localStorage, consent);
  } catch {
    return false;
  }
}

function removeStoredConsent(): boolean {
  try {
    return removePersistedAnalyticsConsent(window.localStorage);
  } catch {
    return false;
  }
}

function clearAnalyticsCookies(): void {
  const names = document.cookie
    .split(';')
    .map((cookie) => cookie.split('=', 1)[0]?.trim() ?? '')
    .filter(isAnalyticsCookieName);
  const domains = new Set(['', window.location.hostname, '27pm.org', '.27pm.org']);

  for (const name of names) {
    for (const domain of domains) {
      const domainAttribute = domain ? `; Domain=${domain}` : '';
      document.cookie = `${name}=; Max-Age=0; Path=/${domainAttribute}; SameSite=Lax`;
    }
  }
}

function setAnalyticsDisabled(disabled: boolean): void {
  (window as typeof window & Record<string, boolean>)[
    `ga-disable-${ANALYTICS_MEASUREMENT_ID}`
  ] = disabled;
}

export function initializeAnalyticsConsent(
  { enabled = false }: AnalyticsConsentOptions = {},
): void {
  if (!enabled) {
    setAnalyticsDisabled(true);
    document.querySelector<HTMLScriptElement>('script[data-google-tag="analytics"]')?.remove();
    removeStoredConsent();
    clearAnalyticsCookies();
    return;
  }

  const dialog = document.querySelector<HTMLElement>('[data-analytics-consent]');
  const dialogTitle = dialog?.querySelector<HTMLElement>('[data-analytics-consent-title]');
  const acceptButton = dialog?.querySelector<HTMLButtonElement>('[data-analytics-accept]');
  const denyButton = dialog?.querySelector<HTMLButtonElement>('[data-analytics-deny]');
  const status = dialog?.querySelector<HTMLElement>('[data-analytics-status]');
  const preferenceButtons = [
    ...document.querySelectorAll<HTMLButtonElement>('[data-analytics-preferences]'),
  ];
  let returnFocus: HTMLButtonElement | null = null;

  const closeDialog = () => {
    if (dialog) dialog.hidden = true;
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  };

  preferenceButtons.forEach((button) => {
    button.hidden = false;
    button.addEventListener('click', () => {
      returnFocus = button;
      if (dialog) dialog.hidden = false;
      dialogTitle?.focus({ preventScroll: true });
    });
  });

  dialog?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !returnFocus) return;
    event.preventDefault();
    closeDialog();
  });

  acceptButton?.addEventListener('click', () => {
    if (!storeConsent('granted')) {
      setAnalyticsDisabled(true);
      if (status) {
        status.textContent = 'Votre navigateur n’a pas permis d’enregistrer ce choix. La mesure demeure désactivée.';
      }
      return;
    }

    if (status) status.textContent = '';
    setAnalyticsDisabled(false);
    loadGoogleAnalytics(browserRuntime());
    closeDialog();
  });

  denyButton?.addEventListener('click', () => {
    const googleTag = document.querySelector<HTMLScriptElement>('script[data-google-tag="analytics"]');
    const denialStored = storeConsent('denied');
    const previousGrantCleared = denialStored || removeStoredConsent();
    setAnalyticsDisabled(true);
    window.gtag?.('consent', 'update', deniedConsent());
    clearAnalyticsCookies();

    if (!previousGrantCleared) {
      googleTag?.remove();
      if (status) {
        status.textContent = 'La mesure est bloquée pour cette page, mais votre navigateur n’a pas permis d’enregistrer le refus.';
      }
      if (dialog) dialog.hidden = false;
      dialogTitle?.focus({ preventScroll: true });
      return;
    }

    if (status) status.textContent = '';
    closeDialog();
    if (googleTag && denialStored) window.location.reload();
    else googleTag?.remove();
  });

  const storedConsent = readStoredConsent();
  setAnalyticsDisabled(storedConsent !== 'granted');
  if (storedConsent === 'granted') loadGoogleAnalytics(browserRuntime());
  if (storedConsent === null && dialog) dialog.hidden = false;
}
