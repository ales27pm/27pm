import { describe, expect, it } from 'vitest';
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  ANALYTICS_COOKIE_MAX_AGE_SECONDS,
  ANALYTICS_MEASUREMENT_ID,
  GOOGLE_TAG_SOURCE,
  buildAnalyticsCommands,
  createGtagQueue,
  isAnalyticsCookieName,
  loadGoogleAnalytics,
  parseAnalyticsConsent,
  persistAnalyticsConsent,
  removePersistedAnalyticsConsent,
  sanitizeAnalyticsPageLocation,
  sanitizeAnalyticsReferrer,
  type AnalyticsRuntime,
} from './analytics';

describe('analytics consent contract', () => {
  it('keeps the approved measurement identifier and a bounded cookie lifetime', () => {
    expect(ANALYTICS_MEASUREMENT_ID).toBe('G-S0SKT2CTV0');
    expect(ANALYTICS_CONSENT_STORAGE_KEY).toBe('27pm.analytics-consent.v1');
    expect(ANALYTICS_COOKIE_MAX_AGE_SECONDS).toBe(60 * 60 * 24 * 60);
    expect(GOOGLE_TAG_SOURCE).toBe(
      'https://www.googletagmanager.com/gtag/js?id=G-S0SKT2CTV0',
    );
  });

  it('accepts only explicit stored consent decisions', () => {
    expect(parseAnalyticsConsent('granted')).toBe('granted');
    expect(parseAnalyticsConsent('denied')).toBe('denied');
    expect(parseAnalyticsConsent(null)).toBeNull();
    expect(parseAnalyticsConsent('')).toBeNull();
    expect(parseAnalyticsConsent('accepted')).toBeNull();
  });

  it('allows only canonical page paths and reduces referrers to their origin', () => {
    expect(sanitizeAnalyticsPageLocation('https://27pm.org/?name=Alexis#contact')).toBe(
      'https://27pm.org/',
    );
    expect(sanitizeAnalyticsPageLocation('https://27pm.org/confidentialite/?from=brief')).toBe(
      'https://27pm.org/confidentialite/',
    );
    expect(sanitizeAnalyticsPageLocation('https://27pm.org/brief-client-alexis?email=secret')).toBe(
      'https://27pm.org/404.html',
    );
    expect(
      sanitizeAnalyticsReferrer('https://example.test/source/path?email=alexis@example.test#details'),
    ).toBe('https://example.test');
    expect(sanitizeAnalyticsPageLocation('mailto:bonjour@27pm.org?subject=Projet')).toBe('');
    expect(sanitizeAnalyticsReferrer('not a url')).toBe('');
  });

  it('fails closed when a browser cannot replace or remove an old grant', () => {
    let value: string | null = 'granted';
    const removableStorage = {
      getItem: () => value,
      setItem: () => { throw new DOMException('blocked', 'SecurityError'); },
      removeItem: () => { value = null; },
    };

    expect(persistAnalyticsConsent(removableStorage, 'denied')).toBe(false);
    expect(removePersistedAnalyticsConsent(removableStorage)).toBe(true);
    expect(value).toBeNull();

    const blockedStorage = {
      getItem: () => 'granted',
      setItem: () => { throw new DOMException('blocked', 'SecurityError'); },
      removeItem: () => { throw new DOMException('blocked', 'SecurityError'); },
    };
    expect(persistAnalyticsConsent(blockedStorage, 'denied')).toBe(false);
    expect(removePersistedAnalyticsConsent(blockedStorage)).toBe(false);
  });

  it('identifies only the cookies used by the GA4 Google tag', () => {
    expect(isAnalyticsCookieName('_ga')).toBe(true);
    expect(isAnalyticsCookieName('_ga_S0SKT2CTV0')).toBe(true);
    expect(isAnalyticsCookieName('_gid')).toBe(false);
    expect(isAnalyticsCookieName('analytics-consent')).toBe(false);
  });

  it('queues the Arguments object required by gtag.js instead of a plain array', () => {
    const dataLayer: Array<IArguments | unknown[]> = [];
    const gtag = createGtagQueue(dataLayer);

    gtag('config', ANALYTICS_MEASUREMENT_ID, { send_page_view: true });

    expect(dataLayer).toHaveLength(1);
    expect(Array.isArray(dataLayer[0])).toBe(false);
    expect(Array.from(dataLayer[0] ?? [])).toEqual([
      'config',
      ANALYTICS_MEASUREMENT_ID,
      { send_page_view: true },
    ]);
  });

  it('queues denied defaults before the granted analytics-only configuration', () => {
    const now = new Date('2026-08-30T02:00:00.000Z');

    expect(buildAnalyticsCommands(now, {
      pageLocation: 'https://27pm.org/?name=Alexis#contact',
      pageReferrer: 'https://example.test/source?email=alexis@example.test',
    })).toEqual([
      [
        'consent',
        'default',
        {
          ad_storage: 'denied',
          analytics_storage: 'denied',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
        },
      ],
      [
        'consent',
        'update',
        {
          ad_storage: 'denied',
          analytics_storage: 'granted',
          ad_user_data: 'denied',
          ad_personalization: 'denied',
        },
      ],
      ['set', 'ads_data_redaction', true],
      ['js', now],
      [
        'config',
        'G-S0SKT2CTV0',
        {
          allow_ad_personalization_signals: false,
          allow_google_signals: false,
          cookie_expires: 60 * 60 * 24 * 60,
          cookie_update: false,
          page_location: 'https://27pm.org/',
          page_referrer: 'https://example.test',
          send_page_view: true,
        },
      ],
    ]);
  });

  it('loads exactly once and only on the canonical HTTPS origin', () => {
    const actions: Array<{ type: 'command'; value: unknown[] } | { type: 'script'; value: string }> = [];
    let hasScript = false;
    const runtime: AnalyticsRuntime = {
      hostname: '27pm.org',
      protocol: 'https:',
      pageLocation: 'https://27pm.org/brief-client-alexis?name=Alexis#contact',
      pageReferrer: 'https://example.test/source?email=alexis@example.test',
      hasGoogleTag: () => hasScript,
      queue: (command) => actions.push({ type: 'command', value: command }),
      appendGoogleTag: (source) => {
        hasScript = true;
        actions.push({ type: 'script', value: source });
      },
    };

    expect(loadGoogleAnalytics(runtime, new Date('2026-08-30T02:00:00.000Z'))).toBe(true);
    expect(actions.at(-1)).toEqual({ type: 'script', value: GOOGLE_TAG_SOURCE });
    expect(actions.slice(0, -1).map((action) => action.type)).toEqual([
      'command',
      'command',
      'command',
      'command',
      'command',
    ]);
    expect(actions.at(-2)).toEqual({
      type: 'command',
      value: [
        'config',
        ANALYTICS_MEASUREMENT_ID,
        expect.objectContaining({
          page_location: 'https://27pm.org/404.html',
          page_referrer: 'https://example.test',
        }),
      ],
    });

    expect(loadGoogleAnalytics(runtime)).toBe(false);
    expect(actions).toHaveLength(6);

    for (const [hostname, protocol] of [
      ['127.0.0.1', 'http:'],
      ['localhost', 'http:'],
      ['ales27pm.github.io', 'https:'],
      ['27pm.org', 'http:'],
      ['www.27pm.org', 'https:'],
    ] as const) {
      const actionCount = actions.length;
      expect(loadGoogleAnalytics({ ...runtime, hostname, protocol, hasGoogleTag: () => false })).toBe(false);
      expect(actions).toHaveLength(actionCount);
    }
  });
});
