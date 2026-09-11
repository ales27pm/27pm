import { expect, test, type Page } from '@playwright/test';

const turnstileSource = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

test.skip(process.env.CRM_TEST_PROFILE !== 'approved', 'Requires the explicitly approved CRM test build.');

async function mockTurnstile(page: Page, verifyImmediately = false): Promise<() => number> {
  let requests = 0;
  await page.route(turnstileSource, async (route) => {
    requests += 1;
    await route.fulfill({
      contentType: 'application/javascript',
      body: `
        window.turnstile = {
          render(container, options) {
            window.__contactLoadingCallback = options.callback;
            window.__contactLoadingRenderCount = (window.__contactLoadingRenderCount || 0) + 1;
            ${verifyImmediately ? "queueMicrotask(() => options.callback('verified-test-token'));" : ''}
            return 'contact-loading-widget';
          },
          reset() {},
        };
      `,
    });
  });
  return () => requests;
}

test('defers the anti-bot script until the contact form approaches the viewport', async ({ page }) => {
  const requests = await mockTurnstile(page);
  let intakeRequests = 0;
  await page.route('https://crm.27pm.org/api/public/intake', async (route) => {
    intakeRequests += 1;
    await route.abort();
  });

  await page.goto('/', { waitUntil: 'networkidle' });
  expect(requests()).toBe(0);
  await expect(page.locator(`script[src="${turnstileSource}"]`)).toHaveCount(0);
  await expect(page.locator('[data-crm-submit]')).toBeDisabled();
  await expect(page.locator('[data-project-mail]')).toHaveAttribute('href', /^mailto:bonjour@27pm\.org(?:\?|$)/);

  await page.locator('[data-contact-form]').scrollIntoViewIfNeeded();
  await expect(page.locator('html')).toHaveAttribute('data-crm-intake', 'enabled');
  expect(requests()).toBe(1);
  await expect(page.locator('[data-crm-submit]')).toBeDisabled();

  await page.evaluate(() => {
    const callback = (window as typeof window & { __contactLoadingCallback?: (token: string) => void })
      .__contactLoadingCallback;
    callback?.('verified-test-token');
  });
  await expect(page.locator('[data-crm-submit]')).toBeEnabled();

  await page.getByLabel('Votre projet').focus();
  await page.evaluate(() => { window.location.hash = 'contact'; });
  await expect(page).toHaveURL(/#contact$/);
  expect(requests()).toBe(1);
  expect(await page.evaluate(() => (
    window as typeof window & { __contactLoadingRenderCount?: number }
  ).__contactLoadingRenderCount)).toBe(1);
  expect(intakeRequests).toBe(0);
});

test('loads the anti-bot script for a direct contact link', async ({ page }) => {
  const requests = await mockTurnstile(page, true);
  await page.goto('/#contact');
  await expect(page.locator('[data-crm-submit]')).toBeEnabled();
  expect(requests()).toBe(1);
});

test('retains the contact flow when IntersectionObserver is unavailable', async ({ page }) => {
  await page.addInitScript(() => { Reflect.deleteProperty(window, 'IntersectionObserver'); });
  const requests = await mockTurnstile(page, true);
  await page.goto('/');
  await expect(page.locator('[data-crm-submit]')).toBeEnabled();
  expect(requests()).toBe(1);
});

test('keeps the email fallback if deferred anti-bot loading fails', async ({ page }) => {
  await page.route(turnstileSource, (route) => route.abort());
  await page.goto('/', { waitUntil: 'networkidle' });
  await page.locator('[data-contact-form]').scrollIntoViewIfNeeded();
  await expect(page.locator('html')).toHaveAttribute('data-crm-intake', 'disabled');
  await expect(page.locator('[data-crm-submit]')).toBeDisabled();
  await expect(page.locator('[data-project-mail]')).toHaveAttribute('href', /^mailto:bonjour@27pm\.org(?:\?|$)/);
  await expect(page.locator('[data-project-status]')).toContainText('Utilisez le courriel préparé');
});
