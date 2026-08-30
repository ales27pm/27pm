import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const analyticsMeasurementId = 'G-S0SKT2CTV0';
const analyticsConsentStorageKey = '27pm.analytics-consent.v1';
const googleTagSource = `https://www.googletagmanager.com/gtag/js?id=${analyticsMeasurementId}`;
const isHostOrSubdomain = (hostname: string, base: string) =>
  hostname === base || hostname.endsWith(`.${base}`);
const isAnalyticsRequest = (url: string) => {
  const hostname = new URL(url).hostname;
  return isHostOrSubdomain(hostname, 'googletagmanager.com')
    || isHostOrSubdomain(hostname, 'google-analytics.com')
    || isHostOrSubdomain(hostname, 'analytics.google.com')
    || isHostOrSubdomain(hostname, 'doubleclick.net')
    || hostname === 'www.google.com';
};

test.beforeEach(async ({ page }) => {
  await page.route(
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit',
    async (route) => {
      await route.fulfill({
        contentType: 'application/javascript',
        body: `
          window.turnstile = {
            render: (container, options) => {
              window.__turnstileOptions = options;
              window.__turnstileCallback = options.callback;
              queueMicrotask(() => options.callback('test-turnstile-token'));
              return 'test-widget';
            },
            reset: () => {
              window.__turnstileResetCount = (window.__turnstileResetCount || 0) + 1;
              queueMicrotask(() => window.__turnstileCallback('renewed-turnstile-token'));
            },
          };
        `,
      });
    },
  );
});

test('renders the complete French v5 landing page', async ({ page }) => {
  await page.goto('/', { waitUntil: 'networkidle' });

  await expect(page).toHaveTitle('27PM | Sites web, applications et IA sur mesure');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    /Clair pour\s+vos clients\.\s+Solide pour vous\./,
  );
  await expect(page.getByRole('heading', { name: 'Une idée. Plusieurs métiers.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Pas des promesses. Des systèmes à essayer.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Portes et Fenêtres Boulet' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Maisons S. Turner' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Et si on bâtissait le vôtre?' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'De l’idée à l’impact, sans détour.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Petit studio. Grande attention.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'On commence par une conversation.' })).toBeVisible();
});

test('switches capability proof with pointer and keyboard controls', async ({ page }) => {
  await page.goto('/');

  const convince = page.locator('[data-capability="convaincre"]');
  const simplify = page.locator('[data-capability="simplifier"]');
  const invent = page.locator('[data-capability="inventer"]');
  const proof = page.locator('[data-capability-proof]');
  const proofImage = page.locator('[data-proof-image]');
  const proofPrototype = page.locator('[data-proof-prototype]');

  await expect(convince).toHaveAttribute('aria-pressed', 'true');
  await expect(proof).toHaveAttribute('data-proof-mode', 'convaincre');
  await expect(page.locator('[data-proof-title]')).toHaveText('Offre complexe');
  await expect(proofImage).toHaveAttribute('src', /portes-fenetres-boulet\.webp$/);
  await expect(proofImage).toBeVisible();
  await expect(proofPrototype).toBeHidden();

  await simplify.click();
  await expect(convince).toHaveAttribute('aria-pressed', 'false');
  await expect(simplify).toHaveAttribute('aria-pressed', 'true');
  await expect(proof).toHaveAttribute('data-proof-mode', 'simplifier');
  await expect(page.locator('[data-proof-title]')).toHaveText('Opération fragmentée');
  await expect(proofImage).toHaveAttribute('src', /maisons-s-turner\.webp$/);
  await expect(page.locator('[data-proof-summary]')).toHaveText(
    'Un système relie les choix, les données et le suivi au même endroit.',
  );

  await simplify.press('ArrowRight');
  await expect(invent).toBeFocused();
  await expect(invent).toHaveAttribute('aria-pressed', 'true');
  await expect(proof).toHaveAttribute('data-proof-mode', 'inventer');
  await expect(page.locator('[data-proof-title]')).toHaveText('Possibilité à valider');
  await expect(proofImage).toBeHidden();
  await expect(proofPrototype).toBeVisible();
});

test('composes the scenario locally without navigation or submission', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#lab');

  const scenarioForm = page.locator('[data-scenario-form]');
  const scenarioTitle = page.locator('[data-scenario-title]');
  const scenarioPoints = page.locator('[data-scenario-points] li');
  const originalUrl = page.url();

  await expect(scenarioForm).not.toHaveAttribute('action');
  await expect(scenarioTitle).toHaveText(
    'Un site éditorial qui transforme les visiteurs en demandes qualifiées et recommande le bon parcours.',
  );

  await page.getByLabel('Simplifier un processus interne').check();
  await page.getByLabel('Tableau de bord').check();
  await page.getByLabel('Règles métier, sans IA').check();

  await expect(scenarioTitle).toHaveText(
    'Un tableau de bord qui réunit les étapes d’un processus interne avec des règles métier explicites, sans IA superflue.',
  );
  await expect(scenarioPoints).toHaveText([
    'Vue opérationnelle',
    'Opérations simplifiées',
    'Règles métier vérifiables',
    'Suivi structuré',
  ]);

  expect(page.url()).toBe(originalUrl);
  await expect(scenarioForm.getByRole('button')).toHaveCount(0);
  await expect(page.getByText(/Les choix saisis.+ne sont pas transmis à 27PM/)).toBeVisible();
});

test('presents both independent projects as clearly labelled full demos', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Concept indépendant 27PM', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Démo complète', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Non officiel et non déployé', { exact: true })).toHaveCount(2);
  await expect(page.getByText(/ni présentés,\s+ni approuvés,\s+ni déployés/)).toBeVisible();
  await expect(page.locator('a[href*=".ts.net"]')).toHaveCount(0);

  const demos = [
    {
      project: 'boulet',
      href: 'https://fenetres-boulet-redesign.ales27pm.chatgpt.site/',
    },
    {
      project: 'turner',
      href: 'https://ales27pm.github.io/s-turner/',
    },
  ];

  for (const demo of demos) {
    const links = page.locator(`a[data-demo-project="${demo.project}"][href="${demo.href}"]`);
    await expect(links).toHaveCount(2);
    for (const link of await links.all()) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /nofollow/);
      await expect(link).toHaveAttribute('rel', /noopener/);
      await expect(link).toHaveAttribute('rel', /noreferrer/);
    }
  }

  await expect(page.getByRole('link', { name: /Entrer dans la démo.*nouvel onglet/ })).toHaveCount(4);
  await expect(page.locator('a[href="https://maisonsturner.ca/"]')).toHaveCount(0);

  const previews = page.locator('.case-visual img');
  await expect(previews).toHaveCount(2);
  await previews.last().scrollIntoViewIfNeeded();
  for (let index = 0; index < 2; index += 1) {
    await expect.poll(() => previews.nth(index).evaluate((image) => {
      const element = image as HTMLImageElement;
      return element.complete && element.naturalWidth === 1440;
    })).toBe(true);
  }
});

test('validates the project brief and keeps the contextual mail action current', async ({ page }) => {
  await page.goto('/#contact');

  const mailLink = page.getByRole('link', { name: 'Préparer un courriel' });
  const context = page.getByLabel('Votre projet');
  const organization = page.getByLabel('Votre organisation');
  const name = page.getByLabel(/Votre nom/);
  const email = page.getByLabel(/Votre courriel/);
  const status = page.locator('[data-project-status]');

  await mailLink.click();
  await expect(context).toBeFocused();
  await expect(context).toHaveAttribute('aria-invalid', 'true');
  await expect(status).toHaveText('Décrivez brièvement votre projet avant de préparer le courriel.');

  await context.fill('Automatiser la qualification de nos demandes.');
  await organization.fill('Atelier Exemple');
  await name.fill('Alexis');
  await email.fill('adresse-invalide');
  await mailLink.click();
  await expect(email).toBeFocused();
  await expect(email).toHaveAttribute('aria-invalid', 'true');
  await expect(status).toHaveText('Vérifiez le format du courriel indiqué.');

  await email.fill('alexis@example.test');
  await page.getByLabel('Automatisation ou IA').check();

  const decodedHref = decodeURIComponent((await mailLink.getAttribute('href')) ?? '');
  expect(decodedHref).toContain('[Projet 27PM] Une automatisation ou un outil d’IA');
  expect(decodedHref).toContain('Automatiser la qualification de nos demandes.');
  expect(decodedHref).toContain('Organisation : Atelier Exemple');
  expect(decodedHref).toContain('Nom : Alexis');
  expect(decodedHref).toContain('Courriel de retour : alexis@example.test');
});

test('supports keyboard project selection and announces the chosen project', async ({ page }) => {
  await page.goto('/#contact');
  const siteOption = page.getByLabel('Un site web', { exact: true });
  const applicationOption = page.getByLabel('Une application', { exact: true });
  const status = page.locator('[data-project-status]');

  await siteOption.focus();
  await page.keyboard.press('ArrowDown');
  await expect(applicationOption).toBeChecked();
  await expect(status).toHaveText('Choix sélectionné : Une application sur mesure.');
  await expect(page.getByRole('link', { name: 'Préparer un courriel' })).toHaveAttribute(
    'href',
    /Une%20application%20sur%20mesure/,
  );
});

test('explains the email handoff and copies the visible fallback address', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (value: string) => window.localStorage.setItem('copied-email', value),
      },
    });
  });
  await page.goto('/#contact');

  await expect(page.getByText('De quoi voulez-vous parler?')).toBeVisible();
  await expect(page.getByText(/Le courriel préparé reste disponible/)).toBeVisible();
  await expect(page.locator('[data-contact-email]')).toBeVisible();

  await page.getByRole('button', { name: 'Copier l’adresse' }).click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('copied-email'))).toBe(
    'bonjour@27pm.org',
  );
  await expect(page.locator('[data-copy-email-status]')).toHaveText('Adresse copiée.');
});

test('submits the exact queued CRM contract once with Turnstile enabled', async ({ page }) => {
  let requestCount = 0;
  let releaseRequest: (() => void) | undefined;
  const requestReleased = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  let capturedHeaders: Record<string, string> = {};
  let capturedPayload: unknown;

  await page.route('https://crm.27pm.org/api/public/intake', async (route) => {
    requestCount += 1;
    capturedHeaders = await route.request().allHeaders();
    capturedPayload = route.request().postDataJSON();
    await requestReleased;
    await route.fulfill({ status: 202 });
  });
  await page.goto('/#contact');

  await expect(page.locator('html')).toHaveAttribute('data-crm-intake', 'enabled');
  await expect.poll(() => page.evaluate(() => {
    const options = (window as typeof window & { __turnstileOptions?: { action?: string } }).__turnstileOptions;
    return options?.action;
  })).toBe('crm_intake');

  await page.getByLabel('Votre projet').fill('Créer un portail client accessible.');
  await page.getByLabel('Votre organisation').fill('Atelier Exemple');
  await page.getByLabel('Votre nom').fill('Alex Tremblay');
  await page.getByLabel('Votre courriel').fill('alex@example.test');
  await page.getByLabel('Une application', { exact: true }).check();
  await page.getByLabel(/J’ai pris connaissance/).check();

  const submit = page.getByRole('button', { name: 'Envoyer pour examen' });
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('[data-project-status]')).toHaveText('Envoi sécurisé en cours…');
  await page.locator('[data-contact-form]').evaluate((form) => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await expect.poll(() => requestCount).toBe(1);
  releaseRequest?.();

  await expect(page.locator('[data-project-status]')).toHaveText(
    'Demande reçue et placée dans la file d’examen. Aucun message ni suivi n’est envoyé automatiquement.',
  );
  await expect(submit).toBeDisabled();
  expect(capturedHeaders['content-type']).toBe('application/json');
  expect(capturedHeaders['idempotency-key']).toMatch(
    /^form-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
  );
  expect(capturedPayload).toEqual({
    organizationName: 'Atelier Exemple',
    contactName: 'Alex Tremblay',
    contactEmail: 'alex@example.test',
    projectType: 'application',
    message: 'Créer un portail client accessible.',
    privacyAcknowledged: true,
    turnstileToken: 'test-turnstile-token',
    website: '',
  });
});

test('validates required CRM fields accessibly before sending', async ({ page }) => {
  await page.goto('/#contact');
  const submit = page.getByRole('button', { name: 'Envoyer pour examen' });
  const organization = page.getByLabel('Votre organisation');
  const name = page.getByLabel('Votre nom');
  const email = page.getByLabel('Votre courriel');
  const context = page.getByLabel('Votre projet');
  const privacy = page.getByLabel(/J’ai pris connaissance/);
  const status = page.locator('[data-project-status]');

  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(organization).toBeFocused();
  await expect(organization).toHaveAttribute('aria-invalid', 'true');
  await expect(status).toHaveText('Indiquez le nom de votre organisation.');

  await organization.fill('Atelier Exemple');
  await name.fill('Alex Tremblay');
  await email.fill('adresse-invalide');
  await context.fill('Créer un portail client.');
  await submit.click();
  await expect(email).toBeFocused();
  await expect(status).toHaveText('Vérifiez le format de votre courriel.');

  await email.fill('alex@example.test');
  await submit.click();
  await expect(privacy).toBeFocused();
  await expect(privacy).toHaveAttribute('aria-invalid', 'true');
  await expect(status).toHaveText(
    'Confirmez avoir pris connaissance de la politique de confidentialité.',
  );
});

test('reuses idempotency on CRM retry and keeps the mail fallback visible', async ({ page }) => {
  const idempotencyKeys: string[] = [];
  let attempt = 0;

  await page.route('https://crm.27pm.org/api/public/intake', async (route) => {
    attempt += 1;
    idempotencyKeys.push((await route.request().allHeaders())['idempotency-key'] ?? '');
    await route.fulfill({ status: attempt === 1 ? 503 : 202 });
  });
  await page.goto('/#contact');
  await page.getByLabel('Votre projet').fill('Refondre notre site.');
  await page.getByLabel('Votre organisation').fill('Exemple inc.');
  await page.getByLabel('Votre nom').fill('Camille Roy');
  await page.getByLabel('Votre courriel').fill('camille@example.test');
  await page.getByLabel(/J’ai pris connaissance/).check();

  const submit = page.getByRole('button', { name: 'Envoyer pour examen' });
  await submit.click();
  await expect(page.locator('[data-project-status]')).toHaveText(
    'L’envoi direct n’a pas abouti. Réessayez ou utilisez le courriel préparé.',
  );
  await expect(page.getByRole('link', { name: 'Préparer un courriel' })).toBeVisible();
  await expect(submit).toBeEnabled();
  await submit.click();
  await expect(page.locator('[data-project-status]')).toHaveAttribute('data-state', 'success');

  expect(idempotencyKeys).toHaveLength(2);
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
});

test('keeps the mail fallback when CRM configuration is absent', async ({ page }) => {
  await page.goto('/#contact');
  const mode = await page.locator('html').getAttribute('data-crm-intake');
  test.skip(mode === 'enabled', 'This assertion runs against the explicit no-key build lane.');

  await expect(page.locator('html')).toHaveAttribute('data-crm-intake', 'disabled');
  await expect(page.locator('.crm-intake')).toBeHidden();
  await expect(page.getByText(/L’envoi direct est indisponible/)).toBeVisible();
  await expect(page.getByRole('link', { name: 'Préparer un courriel' })).toBeVisible();
});

test('has no console errors or failed requests while preparing the CRM form', async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => failedRequests.push(request.url()));

  await page.goto('/#contact', { waitUntil: 'networkidle' });
  await page.getByLabel('Votre projet').fill('Tester le formulaire.');
  await page.getByLabel('Votre organisation').fill('27PM QA');
  await page.getByLabel('Votre nom').fill('QA');
  await page.getByLabel('Votre courriel').fill('qa@example.test');
  await expect(page.getByRole('button', { name: 'Envoyer pour examen' })).toBeEnabled();

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

test('keeps the address usable when clipboard access fails', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error('denied')) },
    });
  });
  await page.goto('/#contact');

  const fallback = page.locator('[data-contact-email]');
  await page.getByRole('button', { name: 'Copier l’adresse' }).click();
  await expect(page.locator('[data-copy-email-status]')).toHaveText(
    'Copie impossible. Sélectionnez l’adresse affichée.',
  );
  await expect(fallback).toBeFocused();
});

test('keeps Google Analytics blocked until the visitor explicitly accepts it', async ({ page }) => {
  const analyticsRequests: string[] = [];
  page.on('request', (request) => {
    if (isAnalyticsRequest(request.url())) analyticsRequests.push(request.url());
  });

  await page.goto('/');

  const consent = page.getByRole('dialog', { name: 'Votre choix, avant toute mesure.' });
  await expect(consent).toBeVisible();
  await expect(page.locator(`script[src="${googleTagSource}"]`)).toHaveCount(0);
  expect(analyticsRequests).toEqual([]);

  await consent.getByRole('button', { name: 'Refuser' }).click();
  await expect(consent).toBeHidden();
  expect(await page.evaluate((key) => localStorage.getItem(key), analyticsConsentStorageKey)).toBe('denied');
  expect(analyticsRequests).toEqual([]);

  await page.goto('/confidentialite/', { waitUntil: 'networkidle' });
  await expect(consent).toBeHidden();
  await expect(page.locator(`script[src="${googleTagSource}"]`)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Préférences de mesure' })).toBeVisible();
  expect(
    await page.evaluate(
      (measurementId) => (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`],
      analyticsMeasurementId,
    ),
  ).toBe(true);
  expect(analyticsRequests).toEqual([]);

  const preferences = page.getByRole('button', { name: 'Préférences de mesure' });
  await preferences.click();
  await expect(consent).toBeVisible();
  await expect(consent.getByRole('heading')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(consent).toBeHidden();
  await expect(preferences).toBeFocused();
});

test('keeps unapproved analytics dormant while preserving its preference control', async ({ page }) => {
  test.skip(process.env.ANALYTICS_TEST_APPROVED === 'true', 'Unapproved-build assertion');
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, 'granted');
    document.cookie = '_ga=stale-client; Path=/';
  }, analyticsConsentStorageKey);

  await page.goto('/');

  const dialog = page.getByRole('dialog', { name: 'Votre choix, avant toute mesure.' });
  const preferences = page.getByRole('button', { name: 'Préférences de mesure' });
  await expect(dialog).toBeHidden();
  await expect(preferences).toBeVisible();
  await expect(page.locator(`script[src="${googleTagSource}"]`)).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), analyticsConsentStorageKey)).toBeNull();
  expect(await page.context().cookies()).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ name: expect.stringMatching(/^_ga(?:_|$)/) })]),
  );

  await preferences.click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Accepter' })).toBeHidden();
  await expect(dialog.getByRole('status')).toHaveText(/n’est pas activée/);
  await dialog.getByRole('button', { name: 'Fermer' }).click();
  await expect(dialog).toBeHidden();
  await expect(preferences).toBeFocused();
});

test('loads and revokes the Google tag on the simulated canonical production origin', async ({ page, request: apiRequest }) => {
  await page.route('https://27pm.org/**', async (route) => {
    const publicUrl = new URL(route.request().url());
    const localUrl = new URL(`${publicUrl.pathname}${publicUrl.search}`, 'http://127.0.0.1:4174');
    const response = await apiRequest.get(localUrl.href);
    await route.fulfill({
      status: response.status(),
      headers: response.headers(),
      body: await response.body(),
    });
  });

  const analyticsRequests: string[] = [];
  page.on('request', (request) => {
    if (isAnalyticsRequest(request.url())) analyticsRequests.push(request.url());
  });
  const googleTagRequests: string[] = [];
  await page.route('https://www.googletagmanager.com/gtag/js**', async (route) => {
    googleTagRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });

  await page.goto(
    'https://27pm.org/brief-client-alexis?name=Alexis&email=alexis%40example.test#contact',
    { waitUntil: 'networkidle' },
  );
  expect(googleTagRequests).toEqual([]);
  expect(analyticsRequests).toEqual([]);
  await expect(page.locator(`script[src="${googleTagSource}"]`)).toHaveCount(0);

  await page.getByRole('dialog').getByRole('button', { name: 'Accepter' }).click();
  await expect.poll(() => googleTagRequests).toHaveLength(1);
  expect(analyticsRequests).toEqual([googleTagSource]);
  await expect(page.locator(`script[src="${googleTagSource}"]`)).toHaveCount(1);

  const queuedCommands = await page.evaluate(() => {
    const dataLayer = (window as unknown as { dataLayer?: Array<ArrayLike<unknown>> }).dataLayer ?? [];
    return dataLayer.map((entry) => ({
      isArguments: Object.prototype.toString.call(entry) === '[object Arguments]',
      values: Array.from(entry),
    }));
  });
  expect(queuedCommands.map(({ isArguments, values }) => ({
    isArguments,
    command: values[0],
  }))).toEqual([
    { isArguments: true, command: 'consent' },
    { isArguments: true, command: 'consent' },
    { isArguments: true, command: 'set' },
    { isArguments: true, command: 'js' },
    { isArguments: true, command: 'config' },
  ]);
  const configCommand = queuedCommands.at(-1)?.values;
  expect(configCommand?.[2]).toEqual(expect.objectContaining({
    page_location: 'https://27pm.org/404.html',
    page_referrer: '',
    send_page_view: true,
  }));
  expect(JSON.stringify(queuedCommands)).not.toContain('Alexis');
  expect(JSON.stringify(queuedCommands)).not.toContain('alexis@example.test');

  await page.evaluate(() => {
    document.cookie = '_ga=test-client; Path=/';
    document.cookie = '_ga_S0SKT2CTV0=test-session; Path=/';
  });
  await page.getByRole('button', { name: 'Préférences de mesure' }).click();
  const reloaded = page.waitForEvent('domcontentloaded');
  await page.getByRole('dialog').getByRole('button', { name: 'Refuser' }).click();
  await reloaded;

  expect(await page.evaluate((key) => localStorage.getItem(key), analyticsConsentStorageKey)).toBe('denied');
  await expect(page.locator(`script[src="${googleTagSource}"]`)).toHaveCount(0);
  expect(googleTagRequests).toHaveLength(1);
  expect(analyticsRequests).toHaveLength(1);
  expect(await page.context().cookies()).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ name: expect.stringMatching(/^_ga(?:_|$)/) })]),
  );
});

test('keeps measurement disabled when the browser cannot persist an acceptance', async ({ page }) => {
  await page.goto('/');
  await page.evaluate((storageKey) => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === storageKey) throw new DOMException('blocked', 'SecurityError');
      originalSetItem.call(this, key, value);
    };
  }, analyticsConsentStorageKey);

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Accepter' }).click();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('status')).toHaveText(/La mesure demeure désactivée/);
  expect(await page.evaluate((key) => localStorage.getItem(key), analyticsConsentStorageKey)).toBeNull();
  await expect(page.locator(`script[src="${googleTagSource}"]`)).toHaveCount(0);
});

test('fails closed when a withdrawal cannot replace or remove an old grant', async ({ page }) => {
  await page.addInitScript((storageKey) => {
    window.localStorage.setItem(storageKey, 'granted');
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key, value) {
      if (key === storageKey) throw new DOMException('blocked', 'SecurityError');
      originalSetItem.call(this, key, value);
    };
    const originalRemoveItem = Storage.prototype.removeItem;
    Storage.prototype.removeItem = function removeItem(key) {
      if (key === storageKey) throw new DOMException('blocked', 'SecurityError');
      originalRemoveItem.call(this, key);
    };
  }, analyticsConsentStorageKey);
  await page.goto('/');
  await page.evaluate(() => {
    const script = document.createElement('script');
    script.dataset.googleTag = 'analytics';
    document.head.append(script);
  });

  await page.getByRole('button', { name: 'Préférences de mesure' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Refuser' }).click();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('status')).toHaveText(/n’a pas permis d’enregistrer le refus/);
  expect(await page.evaluate((key) => localStorage.getItem(key), analyticsConsentStorageKey)).toBe('granted');
  expect(
    await page.evaluate(
      (measurementId) => (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`],
      analyticsMeasurementId,
    ),
  ).toBe(true);
  await expect(page.locator('script[data-google-tag="analytics"]')).toHaveCount(0);
});

test('remembers consent locally without polluting Analytics from non-production origins', async ({ page }) => {
  const analyticsRequests: string[] = [];
  page.on('request', (request) => {
    if (isAnalyticsRequest(request.url())) analyticsRequests.push(request.url());
  });

  await page.goto('/');
  await page.getByRole('dialog').getByRole('button', { name: 'Accepter' }).click();

  await expect(page.locator(`script[src="${googleTagSource}"]`)).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), analyticsConsentStorageKey)).toBe('granted');
  expect(
    await page.evaluate(
      (measurementId) => (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`],
      analyticsMeasurementId,
    ),
  ).toBe(false);
  expect(analyticsRequests).toEqual([]);

  await page.evaluate(() => {
    document.cookie = '_ga=test-client; Path=/';
    document.cookie = '_ga_S0SKT2CTV0=test-session; Path=/';
  });
  await page.getByRole('button', { name: 'Préférences de mesure' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Refuser' }).click();
  await page.waitForLoadState('domcontentloaded');

  expect(await page.evaluate((key) => localStorage.getItem(key), analyticsConsentStorageKey)).toBe('denied');
  expect(
    await page.evaluate(
      (measurementId) => (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`],
      analyticsMeasurementId,
    ),
  ).toBe(true);
  await expect(page.locator(`script[src="${googleTagSource}"]`)).toHaveCount(0);
  expect(analyticsRequests).toEqual([]);
  expect(await page.context().cookies()).not.toEqual(
    expect.arrayContaining([expect.objectContaining({ name: expect.stringMatching(/^_ga(?:_|$)/) })]),
  );
});

test('offers analytics consent controls on every public document', async ({ page }) => {
  for (const path of ['/', '/confidentialite/', '/404.html']) {
    await page.goto(path);
    await page.evaluate((key) => localStorage.removeItem(key), analyticsConsentStorageKey);
    await page.reload();

    await expect(page.getByRole('dialog', { name: 'Votre choix, avant toute mesure.' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Préférences de mesure' })).toBeVisible();
  }
});

test('has no automatically detectable accessibility violations on public pages', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const path of ['/', '/confidentialite/', '/404.html']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, `Accessibility violations on ${path}`).toEqual([]);
  }
});

test('has no accessibility violations in interactive v5 states', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('[data-capability="inventer"]').click();
  await page.getByLabel('Assistant conversationnel').check();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('has no automatically detectable accessibility violations with the mobile menu open', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only assertion');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('loads the selected brand mark, hero field and keyboard skip link', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();

  const mark = page.locator('.hero-visual > img');
  await expect.poll(() => mark.evaluate((image) => {
    const element = image as HTMLImageElement;
    return element.complete && element.naturalWidth === 1024 && element.naturalHeight === 1024;
  })).toBe(true);
  await expect(page.locator('[data-hero-field] line')).toHaveCount(782);
});

test('publishes the selected brand asset set', async ({ page, request }) => {
  const assets = [
    '/assets/brand-v4/27pm-mark-1024.webp',
    '/favicon-64.png',
    '/apple-touch-icon.png',
    '/icon-512.png',
    '/assets/og-27pm-1200x630.png',
  ];

  for (const asset of assets) {
    const response = await request.get(asset);
    expect(response.ok(), asset).toBe(true);
  }

  await page.goto('/');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://27pm.org/assets/og-27pm-1200x630.png',
  );
});

test('publishes a complete privacy SEO contract', async ({ page }) => {
  await page.goto('/confidentialite/');

  await expect(page).toHaveTitle('Politique de confidentialité | 27PM');
  await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité' })).toBeVisible();
  await expect(page.getByText('Responsable de la protection des renseignements personnels', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Vercel' })).toHaveAttribute(
    'href',
    'https://vercel.com/legal/privacy-notice',
  );
  await expect(page.getByRole('heading', { name: 'Mesure d’audience facultative' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Règles de confidentialité de Google' })).toHaveAttribute(
    'href',
    'https://policies.google.com/privacy?hl=fr-CA',
  );
  await expect(page.getByText(/aucun script Google Analytics n’est chargé/i)).toBeVisible();
  await expect(page.getByText('_ga', { exact: true })).toBeVisible();
  await expect(page.getByText('GitHub Pages', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Retour au site' })).toHaveAttribute('href', '/');

  const description =
    'Découvrez comment 27PM protège les renseignements transmis par courriel et utilise Google Analytics uniquement avec votre consentement.';
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', description);
  expect(description.length).toBeGreaterThanOrEqual(120);
  expect(description.length).toBeLessThanOrEqual(170);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://27pm.org/confidentialite/',
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
  ] as const) {
    await expect(page.locator(`meta[property="${property}"]`)).toHaveAttribute('content', content);
  }
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  );

  const webPage = await page.locator('script[type="application/ld+json"]').textContent();
  expect(webPage).not.toBeNull();
  expect(JSON.parse(webPage ?? '{}')).toMatchObject({
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Politique de confidentialité | 27PM',
    url: 'https://27pm.org/confidentialite/',
    description,
    inLanguage: 'fr-CA',
    isPartOf: {
      '@type': 'WebSite',
      name: '27PM',
      url: 'https://27pm.org/',
    },
  });
});

test('provides a branded, non-indexable 404 document', async ({ page }) => {
  await page.goto('/404.html');

  await expect(page).toHaveTitle('Page introuvable | 27PM');
  await expect(page.getByRole('heading', { level: 1, name: 'Cette page est hors cadre.' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.getByRole('link', { name: 'Retourner à l’accueil' })).toHaveAttribute('href', '/');
});

test('publishes coherent production metadata and crawler files', async ({ page, request }) => {
  await page.goto('/');

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://27pm.org/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /systèmes propulsés par l’IA/);
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://27pm.org/assets/og-27pm-1200x630.png',
  );
  await expect(page.getByRole('link', { name: 'Confidentialité', exact: true })).toHaveAttribute(
    'href',
    '/confidentialite/',
  );

  const organization = await page.locator('script[type="application/ld+json"]').textContent();
  expect(organization).not.toBeNull();
  expect(JSON.parse(organization ?? '{}')).toMatchObject({
    '@type': 'Organization',
    url: 'https://27pm.org/',
    email: 'bonjour@27pm.org',
    knowsAbout: expect.arrayContaining([
      'Sites web',
      'Applications sur mesure',
      'Intelligence artificielle appliquée',
      'Accessibilité web',
    ]),
  });

  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain('Sitemap: https://27pm.org/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain('<loc>https://27pm.org/confidentialite/</loc>');
});

test('keeps all public routes inside the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only assertion');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 844 });

  for (const path of ['/', '/confidentialite/', '/404.html']) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `Horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }

  await page.goto('/');
  const menu = page.locator('[data-menu-button]');
  await menu.click();
  await expect(menu).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toHaveAccessibleName('Fermer');
  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
});

test('keeps the mobile menu out of the tab order when closed and traps focus when open', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only assertion');
  await page.goto('/');

  const menu = page.locator('[data-menu-button]');
  const navigation = page.locator('[data-navigation]');

  await expect(navigation).toHaveAttribute('inert', '');
  await expect(navigation).toHaveAttribute('aria-hidden', 'true');

  await menu.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Voir 27PM en action' })).toBeFocused();

  await menu.click();
  await expect(navigation).not.toHaveAttribute('inert', '');
  await expect(navigation).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await expect(page.locator('footer')).toHaveAttribute('inert', '');
  await expect(menu).toHaveAccessibleName('Fermer');

  await menu.focus();
  await page.keyboard.press('Tab');
  await expect(navigation.getByRole('link', { name: 'Capacités' })).toBeFocused();
  await menu.focus();
  await page.keyboard.press('Shift+Tab');
  await expect(navigation.getByRole('link', { name: 'bonjour@27pm.org' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(menu).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(menu).toHaveAttribute('aria-expanded', 'false');
  await expect(menu).toBeFocused();
  await expect(menu).toHaveAccessibleName('Menu');
  await expect(navigation).toHaveAttribute('inert', '');
  await expect(page.locator('main')).not.toHaveAttribute('inert', '');
  await expect(page.locator('footer')).not.toHaveAttribute('inert', '');
});

test('keeps primary navigation available on mobile without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  await page.goto('/');

  await expect(page.getByRole('navigation', { name: 'Navigation principale' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Capacités' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Démarrer un projet' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeHidden();
  await expect(page.getByRole('link', { name: 'Préparer un courriel' })).toBeVisible();
  await expect(page.locator('.crm-intake')).toBeHidden();

  await context.close();
});

test('switches to compact navigation before the desktop hero becomes crowded', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('button', { name: /Menu/ })).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

test('keeps the two-column case-study composition at the 971px reference width', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 971, height: 1000 });
  await page.goto('/#realisations');

  for (const card of await page.locator('.case-study').all()) {
    const copy = await card.locator('.case-copy').boundingBox();
    const visual = await card.locator('.case-visual').boundingBox();
    const status = await card.locator('.case-status').boundingBox();

    expect(copy).not.toBeNull();
    expect(visual).not.toBeNull();
    expect(status).not.toBeNull();
    expect(copy!.x).toBeLessThan(visual!.x);
    expect(status!.y).toBeGreaterThanOrEqual(
      Math.max(copy!.y + copy!.height, visual!.y + visual!.height) - 1,
    );
  }
});

test('switches the closing composition at the approved 900px breakpoint', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const [width, expectedColumns] of [[1440, 2], [901, 2], [900, 1], [390, 1]] as const) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#studio');

    const result = await page.locator('.closing').evaluate((element) => ({
      columns: getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean).length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));

    expect(result.columns, `Closing columns at ${width}px`).toBe(expectedColumns);
    expect(result.overflow, `Horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
});

test('keeps every reveal section visible in print media', async ({ page }) => {
  await page.emulateMedia({ media: 'print', reducedMotion: 'no-preference' });
  await page.goto('/');

  const hiddenItems = await page.locator('[data-reveal]').evaluateAll((items) =>
    items.filter((item) => {
      const style = getComputedStyle(item);
      return style.opacity !== '1' || style.transform !== 'none';
    }).length,
  );
  expect(hiddenItems).toBe(0);
});
