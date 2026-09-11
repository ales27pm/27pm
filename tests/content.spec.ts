import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  ['/services/sites-catalogues-fabricants/', 'Sites web et catalogues pour fabricants québécois'],
  ['/services/applications-web-sur-mesure/', 'Applications web sur mesure pour PME'],
  ['/services/automatisation-ia/', 'Automatisation et IA pour PME'],
  ['/etudes/boulet/', 'Boulet : un concept de catalogue de portes et fenêtres'],
  ['/etudes/maisons-turner/', 'Maisons S. Turner : un concept de catalogue de maisons'],
] as const;

test('returns a true 404 for an unknown service instead of the homepage', async ({ request }) => {
  const response = await request.get('/services/__missing-seo-route__/');
  expect(response.status()).toBe(404);
  expect(await response.text()).not.toContain('Clair pour');
});

for (const [path, heading] of pages) {
  test(`reads and navigates ${path} on the current viewport`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `https://27pm.org${path}`);
    await expect(page.locator('.editorial-related a').first()).toBeVisible();
    const violations = (await new AxeBuilder({ page }).analyze()).violations;
    expect(violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('.editorial-actions a[href="/#contact"]').click();
    await expect(page).toHaveURL(/\/#contact$/);
    await expect(page.getByLabel('Votre projet')).toBeVisible();
  });
}

test('exposes every service and study from the homepage without JavaScript', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL });
  const page = await context.newPage();
  try {
    await page.goto('/');
    for (const [path, heading] of pages) {
      const link = page.locator(`a[href="${path}"]`).first();
      await expect(link).toBeVisible();
      await link.click();
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      if (path.startsWith('/etudes/')) {
        await expect(page.locator('.editorial-lead')).toContainText(/non officiel/);
      }
      await page.getByRole('link', { name: 'Retour au site', exact: true }).click();
    }
  } finally {
    await context.close();
  }
});
