import { expect, test, type Page, type Route } from '@playwright/test';

test.skip(process.env.CRM_TEST_PROFILE !== 'approved', 'Requires the approved CRM build.');
const endpoint = 'https://api.crm.27pm.org/api/public/intake';
const script = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const mockScript = `window.turnstile = {
  render(_container, options) { window.__reliabilityOptions = options; queueMicrotask(() => options.callback('initial-token')); return 'widget'; },
  reset() { queueMicrotask(() => window.__reliabilityOptions.callback('renewed-token')); }
};`;

async function fillDraft(page: Page) {
  await page.goto('/#contact');
  await expect(page.locator('html')).toHaveAttribute('data-crm-intake', 'enabled');
  await page.getByLabel('Votre organisation', { exact: true }).fill('Atelier Test');
  await page.getByLabel('Votre nom', { exact: true }).fill('Alex Test');
  await page.getByLabel('Votre courriel', { exact: true }).fill('test@example.test');
  await page.getByLabel('Votre projet', { exact: true }).fill('Portail client');
  await page.getByLabel(/J’ai pris connaissance/).check();
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route(script, route => route.fulfill({ contentType: 'application/javascript', body: mockScript }));
});

for (const edit of ['space', 'privacy', 'email-case', 'change-and-restore']) {
  test(`preserves retry identity after ${edit}`, async ({ page }) => {
    const keys: string[] = [];
    await page.route(endpoint, async route => {
      keys.push(route.request().headers()['idempotency-key'] ?? '');
      await route.abort();
    });
    await fillDraft(page);
    const send = page.locator('[data-crm-submit]');
    await send.click();
    await expect(page.locator('[data-project-status]')).toContainText('Réception non confirmée');
    if (edit === 'space') await page.getByLabel('Votre projet', { exact: true }).fill('Portail client ');
    if (edit === 'privacy') {
      await page.getByLabel(/J’ai pris connaissance/).uncheck();
      await page.getByLabel(/J’ai pris connaissance/).check();
    }
    if (edit === 'email-case') await page.getByLabel('Votre courriel', { exact: true }).fill('TEST@example.test');
    if (edit === 'change-and-restore') {
      await page.getByLabel('Votre projet', { exact: true }).fill('Autre projet');
      await send.click();
      await expect.poll(() => keys.length).toBe(2);
      await expect(page.locator('[data-project-status]')).toContainText('Réception non confirmée');
      await expect(send).toBeEnabled();
      await page.getByLabel('Votre projet', { exact: true }).fill('Portail client');
    }
    await send.click();
    await expect.poll(() => keys.length).toBe(edit === 'change-and-restore' ? 3 : 2);
    expect(keys.at(-1)).toBe(keys[0]);
    if (edit === 'change-and-restore') expect(keys[1]).not.toBe(keys[0]);
  });
}

for (const callback of ['expired-callback', 'error-callback', 'timeout-callback']) {
  test(`retains confirmed receipt after late ${callback}`, async ({ page }) => {
    let count = 0;
    await page.route(endpoint, route => { count++; return route.fulfill({ status: 202 }); });
    await fillDraft(page);
    await page.locator('[data-crm-submit]').click();
    const status = page.locator('[data-project-status]');
    await expect(status).toHaveAttribute('data-state', 'success');
    const receipt = await status.textContent();
    await page.evaluate(name => {
      (window as typeof window & { __reliabilityOptions: Record<string, () => void> }).__reliabilityOptions[name]?.();
    }, callback);
    await page.getByLabel('Votre projet', { exact: true }).fill('Portail client ');
    await expect(status).toHaveText(receipt ?? '');
    await expect(page.locator('[data-crm-submit]')).toBeDisabled();
    expect(count).toBe(1);
    // Returning to an already accepted draft must not create a fresh submission.
    await page.getByLabel('Votre projet', { exact: true }).fill('Un nouveau projet');
    await expect(page.locator('[data-crm-submit]')).toBeEnabled();
    await page.getByLabel('Votre projet', { exact: true }).fill('Portail client');
    await expect(status).toHaveText(receipt ?? '');
    await expect(page.locator('[data-crm-submit]')).toBeDisabled();
  });
}

test('expires a stalled verification load and permits an explicit retry', async ({ page }) => {
  let loads = 0;
  let stalled: Route | undefined;
  await page.route(script, route => {
    loads++;
    if (loads === 1) { stalled = route; return; }
    return route.fulfill({ contentType: 'application/javascript', body: mockScript });
  });
  await page.clock.install();
  await page.goto('/#contact', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-crm-unavailable]')).toContainText('Chargement');
  await page.clock.fastForward(12_001);
  await expect(page.locator('[data-crm-unavailable]')).toContainText('momentanément indisponible');
  await expect(page.locator('[data-project-mail]')).toBeVisible();
  // Release the failed connection before simulating restored network service.
  // A browser may coalesce two script elements onto the same still-pending request.
  await stalled?.abort();
  await page.getByRole('button', { name: 'Réessayer la vérification' }).click();
  await expect(page.locator('[data-crm-submit]')).toBeEnabled();
  expect(loads).toBe(2);
});

test('blocks an oversized pasted brief without cutting or sending it', async ({ page }) => {
  let posts = 0;
  await page.route(endpoint, route => { posts++; return route.abort(); });
  await fillDraft(page);
  await page.getByLabel('Votre projet', { exact: true }).fill('x'.repeat(4999) + '😀');
  await page.locator('[data-crm-submit]').click();
  await expect(page.locator('[data-project-status]')).toContainText('dépasse la limite');
  await expect(page.locator('[data-contact-context]')).toHaveValue('x'.repeat(4999) + '😀');
  await expect(page.locator('[data-project-mail]')).not.toHaveAttribute('href');
  expect(posts).toBe(0);
});

for (const [label, value] of [
  ['Votre organisation', 'o'.repeat(201)],
  ['Votre nom', 'n'.repeat(121)],
  ['Votre courriel', `${'a'.repeat(243)}@example.test`],
]) {
  test(`preserves an oversized pasted ${label} and prevents transmission`, async ({ page }) => {
    let posts = 0;
    await page.route(endpoint, route => { posts++; return route.abort(); });
    await fillDraft(page);
    const field = page.getByLabel(label!, { exact: true });
    await field.fill(value!);
    await page.locator('[data-crm-submit]').click();
    await expect(field).toHaveValue(value!);
    await expect(field).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('[data-project-status]')).toContainText('dépasse la limite');
    await expect(page.locator('[data-project-mail]')).not.toHaveAttribute('href');
    expect(posts).toBe(0);
  });
}

test('remains bounded while retry fetch is pending and recovers after its late success', async ({ page }) => {
  const pending: Route[] = [];
  await page.route(script, route => { pending.push(route); });
  await page.clock.install();
  await page.goto('/#contact', { waitUntil: 'domcontentloaded' });
  await expect.poll(() => pending.length).toBe(1);
  await page.clock.fastForward(12_001);
  await page.getByRole('button', { name: 'Réessayer la vérification' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-crm-intake', 'loading');
  await page.clock.fastForward(12_001);
  await expect(page.locator('[data-crm-unavailable]')).toContainText('momentanément indisponible');
  await expect(page.locator('[data-project-mail]')).toBeVisible();
  // A removed script element may still execute on late completion. It must not
  // auto-submit; the explicit retry can reuse the resulting API exactly once.
  for (const route of pending) await route.fulfill({ contentType: 'application/javascript', body: mockScript });
  await page.waitForFunction(() => Boolean(window.turnstile));
  await expect(page.locator('html')).toHaveAttribute('data-crm-intake', 'disabled');
  await page.getByRole('button', { name: 'Réessayer la vérification' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-crm-intake', 'enabled');
  await expect(page.locator('[data-crm-submit]')).toBeEnabled();
  await expect(page.locator('[data-project-status]')).not.toContainText('Réception confirmée');
});
