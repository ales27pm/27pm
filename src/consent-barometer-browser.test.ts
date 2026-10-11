import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { chromium, type Browser } from 'playwright';
import { classifyStablePage, collectSite, detectChallenge, findBanner, isExternalHost, keyboardReject, type SiteEntry } from '../scripts/collect-consent-barometer.mjs';

let browser: Browser;
let server: Server;
let baseUrl: string;

const banner = (reject = '<button id="reject" type="button">Refuser</button>') => `
  <section class="cookie-consent" role="dialog" aria-modal="true" aria-labelledby="consent-title">
    <h2 id="consent-title">Choix des témoins</h2>
    <a href="/confidentialite">Politique de confidentialité</a>
    ${reject}
  </section>`;

const page = (body: string, script = '') => `<!doctype html>
<html lang="fr-CA"><head><meta charset="utf-8"><style>
  .cookie-consent { position: fixed; inset: auto 1rem 1rem; padding: 1rem; background: white; border: 2px solid #111; }
  button:focus-visible, input:focus-visible { outline: 4px solid #2846b8; }
</style></head><body>${body}<script>${script}</script></body></html>`;

function site(pathname = '/'): SiteEntry {
  return { site_id: 'fixture-001', url: `${baseUrl}${pathname}`, eligibility: 'included' };
}

const fast = { initialWaitMs: 40, afterActionDelayMs: 40 };

beforeAll(async () => {
  server = createServer((request, response) => {
    response.setHeader('content-type', 'text/html; charset=utf-8');
    const pathname = new URL(request.url ?? '/', 'http://fixture.test').pathname;
    if (pathname === '/') {
      if (request.headers['x-final-response-fixture'] === 'failure') {
        response.end(page('<main>Navigation retardée</main>', `setTimeout(() => location.assign('/fr/'), 10)`));
        return;
      }
      response.end(page('<main>Fixture mobile</main><div id="mount"></div>', `
        if (/Mobile/i.test(navigator.userAgent) && navigator.maxTouchPoints > 0) {
          document.querySelector('#mount').innerHTML = ${JSON.stringify(banner())};
          document.querySelector('#reject').addEventListener('click', () => document.querySelector('.cookie-consent').remove());
        }
      `));
      return;
    }
    if (pathname === '/fr/') {
      if (request.headers['x-final-response-fixture'] === 'failure') {
        response.statusCode = 500;
        response.setHeader('content-type', 'application/json');
        response.end('{"message":"final failure"}');
        return;
      }
      response.end(page(banner('<input id="reject" type="button" value="Refuser">'), `
        document.querySelector('#reject').addEventListener('click', () => document.querySelector('.cookie-consent').remove());
      `));
      return;
    }
    if (pathname === '/en/') {
      response.end(page(`${banner('')}<footer><button type="button">Refuser</button></footer>`));
      return;
    }
    if (pathname === '/en') {
      response.statusCode = 500;
      response.end(page(banner()));
      return;
    }
    if (pathname === '/fr-ca/') {
      response.end(page(banner('<button type="button">Refuser</button><button type="button">Tout refuser</button>')));
      return;
    }
    if (pathname === '/fr-ca') {
      response.end(page('<main>Fixture Shadow DOM</main><div id="shadow-host"></div>', `
        const root = document.querySelector('#shadow-host').attachShadow({ mode: 'open' });
        root.innerHTML = ${JSON.stringify(`
          <style>
            .cookie-consent { position: fixed; inset: auto 1rem 1rem; padding: 1rem; background: white; border: 2px solid #111; }
            button:focus-visible { outline: 4px solid #2846b8; }
          </style>
          ${banner()}
        `)};
        root.querySelector('#reject').addEventListener('click', () => root.querySelector('.cookie-consent').remove());
      `));
      return;
    }
    if (pathname === '/en-ca/') {
      response.end(page(banner(), `
        document.querySelector('#reject').addEventListener('click', () => {
          document.querySelector('.cookie-consent').remove();
          document.body.insertAdjacentHTML('beforeend', ${JSON.stringify(banner('<button type="button">Refuser</button>'))});
        });
      `));
      return;
    }
    if (pathname === '/en-ca') {
      response.end(page(banner(), `
        document.querySelector('#reject').addEventListener('click', () => {
          history.pushState({}, '', '/home');
          document.querySelector('.cookie-consent').remove();
        });
      `));
      return;
    }
    if (pathname === '/accueil/') {
      response.end(page(banner('<button type="button" tabindex="-1">Refuser</button>')));
      return;
    }
    if (pathname === '/accueil') {
      response.end(page(banner(), `
        setTimeout(() => history.pushState({}, '', '/article'), 10);
      `));
      return;
    }
    if (pathname === '/home/') {
      response.statusCode = 302;
      response.setHeader('location', '/article');
      response.end();
      return;
    }
    if (pathname === '/home') {
      response.setHeader('content-type', 'application/json');
      response.end('{"message":"not html"}');
      return;
    }
    if (pathname === '/fr') {
      response.end(page('<main><h1>Checking your browser</h1><p>Verify you are human</p></main>'));
      return;
    }
    response.end(page('<main>Aucune bannière</main>'));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Adresse de fixture indisponible.');
  baseUrl = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((resolve, reject) => server?.close((error) => error ? reject(error) : resolve()));
});

describe('consent barometer browser boundaries', () => {
  it('classifies stable destinations without conflating www, platforms, MIME or challenges', () => {
    expect(classifyStablePage({ initialUrl: 'http://www.example.com/', finalUrl: 'https://example.com/', status: 200, contentType: 'text/html; charset=utf-8' })).toEqual({ analyzable: true, reason: null });
    expect(classifyStablePage({ initialUrl: 'https://example.com/', finalUrl: 'https://other.example/', status: 200, contentType: 'text/html' }).reason).toBe('cross_host_destination');
    expect(classifyStablePage({ initialUrl: 'https://example.com/', finalUrl: 'https://facebook.com/', status: 200, contentType: 'text/html' }).reason).toBe('platform_destination');
    expect(classifyStablePage({ initialUrl: 'https://facebook.com/', finalUrl: 'https://facebook.com/', status: 200, contentType: 'text/html' }).reason).toBe('platform_destination');
    expect(classifyStablePage({ initialUrl: 'https://example.com/', finalUrl: 'https://example.com/article', status: 200, contentType: 'text/html' }).reason).toBe('non_homepage_destination');
    expect(classifyStablePage({ initialUrl: 'https://example.com/', finalUrl: 'https://example.com/', status: 200, contentType: 'application/pdf' }).reason).toBe('non_html');
    expect(classifyStablePage({ initialUrl: 'https://example.com/', finalUrl: 'https://example.com/', status: 200, contentType: 'text/html', challengeDetected: true }).reason).toBe('challenge_or_interstitial');
    expect(isExternalHost('www.example.com', 'https://example.com/')).toBe(false);
    expect(isExternalHost('cdn.example.net', 'https://example.com/')).toBe(true);
  });

  it('prefers a visible native dialog over static footer and transparent consent candidates', async () => {
    const context = await browser.newContext();
    const testPage = await context.newPage();
    await testPage.setContent(page(`
      <footer><section class="cookie-consent"><p>Cookies</p><button>Refuser</button></section></footer>
      <section class="cookie-consent" style="opacity:0"><p>Cookies</p><button>Refuser</button></section>
      <dialog open aria-labelledby="native-title"><h2 id="native-title">Choix des témoins</h2><a href="/recette-cookies">Recette cookies</a><button>Refuser</button></dialog>
    `));
    const result = await findBanner(testPage);
    expect(result).toMatchObject({ detected: true, rejectCount: 1, dialogRole: true, dialogHasName: true, privacyLink: false });
    await context.close();
  });

  it('recognizes alertdialog and a precise consent privacy link', async () => {
    const context = await browser.newContext();
    const testPage = await context.newPage();
    await testPage.setContent(page('<section role="alertdialog" aria-label="Consentement"><p>Cookies</p><a href="/politique-cookies">Politique sur les témoins</a><button>Refuser</button></section>'));
    const result = await findBanner(testPage);
    expect(result).toMatchObject({ detected: true, dialogRole: true, dialogHasName: true, privacyLink: true });
    await context.close();
  });

  it('does not mistake an unrelated refusal dialog for a consent banner', async () => {
    const context = await browser.newContext();
    const testPage = await context.newPage();
    await testPage.setContent(page('<dialog open aria-label="Invitation"><p>Voulez-vous participer à notre sondage?</p><button>Refuser</button></dialog>'));
    expect(await findBanner(testPage)).toMatchObject({ detected: false, rejectCount: 0 });
    await context.close();
  });

  it('rejects static cookie or consent content without a modal, overlay or consent control', async () => {
    const context = await browser.newContext();
    const testPage = await context.newPage();
    await testPage.setContent(page(`
      <header><div class="cookie-notice">Notre article explique les cookies.</div></header>
      <main><section id="consent-history">Histoire du consentement numérique.</section></main>
      <article><div class="cookie-recipe">Recette de cookies et confidentialité.</div></article>
    `));
    expect(await findBanner(testPage)).toMatchObject({ detected: false, rejectCount: 0 });
    await context.close();
  });

  it('rejects static page-region cookie controls without a modal, overlay or floating signal', async () => {
    const context = await browser.newContext();
    const testPage = await context.newPage();
    await testPage.setContent(page(`
      <header><section class="cookie-consent" style="position:static"><p>Paramètres des cookies</p><button>Refuser</button></section></header>
      <main><section class="cookie-consent" style="position:static"><p>Préférences de consentement</p><button>Tout refuser</button></section></main>
      <footer><section class="cookie-consent" style="position:static"><p>Paramètres des cookies</p><button>Refuser</button></section></footer>
    `));
    expect(await findBanner(testPage)).toMatchObject({ detected: false, rejectCount: 0 });
    await context.close();
  });

  it('does not mistake a normal embedded CAPTCHA mention for an interstitial', async () => {
    const context = await browser.newContext();
    const testPage = await context.newPage();
    await testPage.setContent(page('<main><h1>Réservations</h1><p>Un CAPTCHA protège le formulaire contre le pourriel.</p><form><input name="email"></form></main>'));
    expect(await detectChallenge(testPage)).toBe(false);
    await testPage.setContent(page('<article><h1>Comprendre les contrôles anti-robots</h1><p>Le message « Verify you are human » peut apparaître sur certains sites.</p></article>'));
    expect(await detectChallenge(testPage)).toBe(false);
    await testPage.setContent(page('<main><h1>Checking your browser</h1><p>Verify you are human</p></main>'));
    expect(await detectChallenge(testPage)).toBe(true);
    await testPage.setContent(page('<main>Contenu protégé</main><div id="challenge-host"></div>', `
      const root = document.querySelector('#challenge-host').attachShadow({ mode: 'open' });
      root.innerHTML = '<h1>Checking your browser</h1><p>Verify you are human</p>';
    `));
    expect(await detectChallenge(testPage)).toBe(true);
    await context.close();
  });

  it('does not count a transparent focus outline as a visible indicator', async () => {
    const context = await browser.newContext();
    const testPage = await context.newPage();
    await testPage.setContent(`<!doctype html><style>
      .cookie-consent { position: fixed; background: white; }
      button:focus-visible { outline: 4px solid transparent; }
    </style><section class="cookie-consent" role="dialog" aria-label="Consentement"><p>Cookies</p><button id="reject">Refuser</button></section>
    <script>document.querySelector('#reject').addEventListener('click', () => document.querySelector('.cookie-consent').remove())</script>`);
    await findBanner(testPage);
    const result = await keyboardReject(testPage, { afterActionDelayMs: 20 });
    expect(result.focusIndicatorHeuristic).toBe(false);
    expect(result.actionResult).toBe('closed');
    await context.close();
  });
  it('uses a real mobile user agent and touch profile', async () => {
    const observation = await collectSite(browser, site('/'), fast);
    expect(observation.user_agent).toMatch(/Mobile/);
    expect(observation.user_agent).toMatch(/Chrome\//);
    expect(String(observation.device_profile)).not.toMatch(/iPhone|Safari/i);
    expect(observation.touch_points).toBeGreaterThan(0);
    expect(observation.banner_detected).toBe('yes');
  }, 15_000);

  it('uses the platform accessible name for a native input button', async () => {
    const observation = await collectSite(browser, site('/fr/'), fast);
    expect(observation.reject_first_layer).toBe('yes');
    expect(observation.keyboard_reject_steps).toBeGreaterThan(0);
    expect(observation.reject_action_closed).toBe('yes');
  }, 15_000);

  it('ignores a reject action outside the detected banner', async () => {
    const observation = await collectSite(browser, site('/en/'), fast);
    expect(observation.banner_detected).toBe('yes');
    expect(observation.reject_first_layer).toBe('no');
    expect(observation.keyboard_reject_steps).toBeNull();
  }, 15_000);

  it('keeps multiple in-banner reject actions indeterminate', async () => {
    const observation = await collectSite(browser, site('/fr-ca/'), fast);
    expect(observation.reject_first_layer).toBe('indeterminate');
    expect(observation.keyboard_reject_steps).toBeNull();
  }, 15_000);

  it('scopes Axe to a detected banner inside an open ShadowRoot', async () => {
    const observation = await collectSite(browser, site('/fr-ca'), {
      ...fast,
      rejectByKeyboard: async () => ({
        steps: null,
        focusIndicatorHeuristic: null,
        activated: false,
        actionResult: 'indeterminate',
        errors: [],
      }),
    });
    expect(observation.banner_detected).toBe('yes');
    expect(observation.axe_rule_count_banner).not.toBeNull();
    expect(observation.errors.join(' ')).not.toMatch(/Axe:/);
  }, 15_000);

  it('recognizes and activates the marked reject control inside an open ShadowRoot', async () => {
    const observation = await collectSite(browser, site('/fr-ca'), {
      ...fast,
      analyzeBanner: async () => ({ violations: [] }),
    });
    expect(observation.reject_first_layer).toBe('yes');
    expect(observation.keyboard_reject_steps).toBeGreaterThan(0);
    expect(observation.focus_indicator_heuristic).toBe('yes');
    expect(observation.reject_action_closed).toBe('yes');
  }, 15_000);

  it('resolves aria-labelledby in the dialog local ShadowRoot', async () => {
    const observation = await collectSite(browser, site('/fr-ca'), {
      ...fast,
      analyzeBanner: async () => ({ violations: [] }),
      rejectByKeyboard: async () => ({
        steps: null,
        focusIndicatorHeuristic: null,
        activated: false,
        actionResult: 'indeterminate',
        errors: [],
      }),
    });
    expect(observation.dialog_role_present).toBe(true);
    expect(observation.dialog_accessible_name).toBe('yes');
  }, 15_000);

  it('does not report closed when the banner is re-rendered after Enter', async () => {
    const observation = await collectSite(browser, site('/en-ca/'), fast);
    expect(observation.keyboard_reject_steps).toBeGreaterThan(0);
    expect(observation.reject_action_closed).toBe('no');
  }, 15_000);

  it('reports a banner hidden by a composed ancestor as closed', async () => {
    const context = await browser.newContext();
    const testPage = await context.newPage();
    await testPage.setContent(page(`<div id="consent-layer">${banner()}</div>`, `
      document.querySelector('#reject').addEventListener('click', () => { document.querySelector('#consent-layer').style.opacity = '0'; });
    `));
    await findBanner(testPage);
    const result = await keyboardReject(testPage, { afterActionDelayMs: 20 });
    expect(result.actionResult).toBe('closed');
    await context.close();
  });

  it('counts Tab presses from a deterministic document-start sentinel', async () => {
    const context = await browser.newContext();
    const testPage = await context.newPage();
    await testPage.setContent(page(`
      <button id="outside" type="button">Avant la bannière</button>
      <section class="cookie-consent" role="dialog" aria-label="Consentement"><p>Cookies</p><button id="reject" type="button">Refuser</button></section>
    `, `
      document.querySelector('#outside').focus();
      document.querySelector('#reject').addEventListener('click', () => document.querySelector('.cookie-consent').remove());
    `));
    await findBanner(testPage);
    const result = await keyboardReject(testPage, { afterActionDelayMs: 20 });
    expect(result.steps).toBe(2);
    expect(result.actionResult).toBe('closed');
    await context.close();
  });

  it('never reports a navigation-triggering reject action as a closed banner', async () => {
    const observation = await collectSite(browser, site('/en-ca'), fast);
    expect(observation.keyboard_reject_steps).toBeGreaterThan(0);
    expect(observation.reject_action_result).toBe('navigated');
    expect(observation.reject_action_closed).toBe('indeterminate');
    expect(observation.cookies_after_reject_count).toBeNull();
  }, 15_000);

  it('keeps keyboard-dependent fields missing when the reject control is unreachable', async () => {
    const observation = await collectSite(browser, site('/accueil/'), fast);
    expect(observation.reject_first_layer).toBe('yes');
    expect(observation.keyboard_reject_steps).toBeNull();
    expect(observation.focus_indicator_heuristic).toBe('indeterminate');
    expect(observation.reject_action_closed).toBe('indeterminate');
  }, 15_000);

  it('rejects a redirect away from an allowed homepage', async () => {
    const observation = await collectSite(browser, site('/home/'), fast);
    expect(observation.final_status).toBeNull();
    expect(observation.banner_detected).toBe('indeterminate');
    expect(observation.errors.join(' ')).toMatch(/non_homepage_destination/i);
  }, 15_000);

  it('rejects a delayed SPA transition away from an allowed homepage before measuring', async () => {
    const observation = await collectSite(browser, site('/accueil'), fast);
    expect(observation.final_status).toBeNull();
    expect(observation.banner_detected).toBe('indeterminate');
    expect(observation.cookies_before_choice_count).toBeNull();
    expect(observation.errors.join(' ')).toMatch(/non_homepage_destination/i);
    expect(observation.errors.join(' ')).not.toMatch(/https?:\/\//i);
  }, 15_000);

  it('invalidates every metric when the page changes during analysis', async () => {
    const observation = await collectSite(browser, site('/'), {
      ...fast,
      detectBanner: async (targetPage) => {
        await targetPage.evaluate(() => history.pushState({}, '', '/article'));
        return { detected: false, rejectCount: 0 };
      },
    });
    expect(observation).toMatchObject({
      analyzable: false,
      analysis_reason: 'page_changed_during_analysis',
      final_status: null,
      banner_detected: 'indeterminate',
      cookies_before_choice_count: null,
      external_hosts_before_choice_count: null,
    });
    expect(observation.errors).toEqual(['observation indéterminée: page_changed_during_analysis']);
  }, 15_000);

  it('keeps HTTP error pages indeterminate and does not analyze their content', async () => {
    const observation = await collectSite(browser, site('/en'), fast);
    expect(observation.final_status).toBe(500);
    expect(observation.banner_detected).toBe('indeterminate');
    expect(observation.reject_first_layer).toBe('indeterminate');
    expect(observation.axe_rule_count_banner).toBeNull();
    expect(observation.cookies_before_choice_count).toBeNull();
    expect(observation.errors).toEqual(['observation indéterminée: http_status']);
  }, 15_000);

  it('uses the final main-frame response after a delayed navigation', async () => {
    const observation = await collectSite(browser, site('/'), {
      ...fast,
      initialWaitMs: 120,
      contextOptions: { extraHTTPHeaders: { 'x-final-response-fixture': 'failure' } },
    });
    expect(observation).toMatchObject({
      http_responded: true,
      analyzable: false,
      analysis_reason: 'http_status',
      final_status: 500,
      banner_detected: 'indeterminate',
    });
    expect(observation.cookies_before_choice_count).toBeNull();
  }, 15_000);

  it('keeps non-HTML and challenge pages outside analyzable denominators', async () => {
    const nonHtml = await collectSite(browser, site('/home'), fast);
    expect(nonHtml).toMatchObject({ http_responded: true, analyzable: false, analysis_reason: 'non_html', banner_detected: 'indeterminate' });
    const challenge = await collectSite(browser, site('/fr'), fast);
    expect(challenge).toMatchObject({ http_responded: true, analyzable: false, analysis_reason: 'challenge_or_interstitial', banner_detected: 'indeterminate' });
  }, 15_000);

  it('starts post-action request accounting only at activation', async () => {
    let activationStarted = false;
    const observation = await collectSite(browser, site('/fr/'), {
      ...fast,
      analyzeBanner: async () => ({ violations: [] }),
      rejectByKeyboard: async (_targetPage, options) => {
        expect(activationStarted).toBe(false);
        await options.onBeforeActivation();
        activationStarted = true;
        return { steps: 1, focusIndicatorHeuristic: true, activated: false, actionResult: 'indeterminate', errors: [] };
      },
    });
    expect(activationStarted).toBe(true);
    expect(observation.keyboard_reject_steps).toBe(1);
  }, 15_000);

  it('captures requests and storage created during keyboard traversal before activation', async () => {
    const observation = await collectSite(browser, site('/fr/'), {
      ...fast,
      analyzeBanner: async () => ({ violations: [] }),
      rejectByKeyboard: async (targetPage, options) => {
        await targetPage.evaluate(() => {
          localStorage.setItem('created-during-tab', '1');
          fetch('https://preactivation.invalid/pixel', { mode: 'no-cors' }).catch(() => {});
        });
        await options.onBeforeActivation();
        return { steps: 1, focusIndicatorHeuristic: true, activated: false, actionResult: 'indeterminate', errors: [] };
      },
    });
    expect(observation.document_storage_keys_before_choice_count).toBe(1);
    expect(observation.external_hosts_before_choice_count).toBe(1);
  }, 15_000);

  it('preserves indeterminate values after navigation failure', async () => {
    const observation = await collectSite(browser, { site_id: 'fixture-002', url: 'http://127.0.0.1:1/', eligibility: 'included' }, fast);
    expect(observation.final_status).toBeNull();
    expect(observation.dialog_role_present).toBeNull();
    expect(observation.dialog_accessible_name).toBe('indeterminate');
    expect(observation.cookies_before_choice_count).toBeNull();
    expect(observation.banner_detected).toBe('indeterminate');
    expect(observation.errors.length).toBeGreaterThan(0);
  }, 15_000);

  it('keeps visibility and Axe failures explicit instead of turning them into facts', async () => {
    const observation = await collectSite(browser, site('/fr/'), {
      ...fast,
      analyzeBanner: async () => { throw new Error('axe controlled failure'); },
      rejectByKeyboard: (targetPage, options) => keyboardReject(targetPage, {
        ...options,
        detectBannerAfterAction: async () => { throw new Error('visibility controlled failure'); },
      }),
    });
    expect(observation.axe_rule_count_banner).toBeNull();
    expect(observation.reject_action_closed).toBe('indeterminate');
    expect(observation.cookies_after_reject_count).not.toBeNull();
    expect(observation.errors.join(' ')).toMatch(/Axe/);
    expect(observation.errors.join(' ')).toMatch(/visibilité après refus/);
  }, 15_000);

  it('keeps cookie and storage read failures null and documented', async () => {
    const observation = await collectSite(browser, site('/en/'), {
      ...fast,
      readStorageCounts: async () => ({ cookies: null, storage: null, errors: ['témoins: controlled failure', 'stockage Web: controlled failure'] }),
    });
    expect(observation.cookies_before_choice_count).toBeNull();
    expect(observation.document_storage_keys_before_choice_count).toBeNull();
    expect(observation.errors.join(' ')).toMatch(/témoins: controlled failure/);
    expect(observation.errors.join(' ')).toMatch(/stockage Web: controlled failure/);
  }, 15_000);
});
