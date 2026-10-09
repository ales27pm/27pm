import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  ['/services/creation-sites-web/', 'Création de site web pour les PME du Québec'],
  ['/services/agence-web/', 'Agence web au Québec : conception, refonte et développement'],
  ['/services/refonte-site-web/', 'Refonte de site web au Québec : préserver vos acquis'],
  ['/services/sites-catalogues-fabricants/', 'Sites web et catalogues pour fabricants québécois'],
  ['/services/applications-web-sur-mesure/', 'Applications web sur mesure pour PME au Québec'],
  ['/services/automatisation-ia/', 'Automatisation et IA pour PME au Québec'],
  ['/auteurs/alexis-boulet/', 'Alexis Boulet, fondateur de 27PM'],
  ['/ressources/checklist-fin-projet-web/', 'Checklist de fin de projet web : garder le contrôle'],
  ['/etudes/boulet/', 'Boulet : un concept de catalogue de portes et fenêtres'],
  ['/etudes/maisons-turner/', 'Maisons S. Turner : un concept de catalogue de maisons'],
] as const;

const homepagePages = pages.filter(([path]) => !path.startsWith('/ressources/'));

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
    for (const [path, heading] of homepagePages) {
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

test('offers the editable end-of-project checklist CSV', async ({ page, request }) => {
  await page.goto('/ressources/checklist-fin-projet-web/');
  await expect(page.locator('.editorial-actions').getByRole('link', { name: 'Télécharger la checklist en CSV' })).toHaveAttribute(
    'href',
    '/ressources/checklist-fin-projet-web.csv',
  );
  const response = await request.get('/ressources/checklist-fin-projet-web.csv');
  expect(response.status()).toBe(200);
  const csv = await response.text();
  expect(csv).toContain('zone_de_controle,quoi_verifier,preuves_a_conserver');
  expect(csv.split('\n')[0]).toContain('statut,niveau_preuve,notes');
  expect(csv.match(/,"À vérifier","non_documente",/g)).toHaveLength(8);

  await expect(page.getByRole('link', { name: 'Télécharger le référentiel en JSON' }).first()).toHaveAttribute(
    'href',
    '/ressources/checklist-fin-projet-web.json',
  );
  const jsonResponse = await request.get('/ressources/checklist-fin-projet-web.json');
  expect(jsonResponse.status()).toBe(200);
  expect(jsonResponse.headers()['content-type']).toContain('application/json');
  const framework = await jsonResponse.json();
  expect(framework).toEqual(expect.objectContaining({
    schema_version: '1.0',
    resource_version: '1.0.0',
    id: 'https://27pm.org/ressources/checklist-fin-projet-web/#referentiel',
    canonical_url: 'https://27pm.org/ressources/checklist-fin-projet-web/',
  }));
  expect(framework.controls).toHaveLength(8);
  expect(framework.states.map((state: { id: string }) => state.id)).toEqual([
    'a_verifier',
    'verifie',
    'a_corriger',
    'non_applicable',
  ]);
  expect(framework.evidence_levels.map((level: { id: string }) => level.id)).toEqual([
    'non_documente',
    'documente',
    'verifie',
    'teste',
  ]);
  expect(framework.method.evidence_level_rule).toContain('niveau le plus faible');
  expect(framework).not.toHaveProperty('overall_states');

  const schema = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
  )['@graph'];
  const article = schema.find((node: { '@type': string | string[] }) => (
    Array.isArray(node['@type']) && node['@type'].includes('TechArticle')
  ));
  expect(article.hasPart['@id']).toBe(framework.id);

  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute('content', 'article');
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://27pm.org/assets/checklist-fin-projet-web-1200x630.png',
  );
  const imageResponse = await request.get('/assets/checklist-fin-projet-web-1200x630.png');
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()['content-type']).toContain('image/png');

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'checklist de fin de projet web', exact: true }).first()).toHaveAttribute(
    'href',
    '/ressources/checklist-fin-projet-web/',
  );
});

test('publishes a canonical author profile and linked visible bylines', async ({ page }) => {
  await page.goto('/auteurs/alexis-boulet/');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    'https://27pm.org/auteurs/alexis-boulet/',
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Alexis Boulet, fondateur de 27PM');
  await expect(page.getByRole('link', { name: 'Voir le compte GitHub public' })).toHaveAttribute(
    'href',
    'https://github.com/ales27pm',
  );

  const schema = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
  )['@graph'];
  expect(schema).toEqual(expect.arrayContaining([
    expect.objectContaining({
      '@type': ['ProfilePage', 'WebPage'],
      mainEntity: { '@id': 'https://27pm.org/auteurs/alexis-boulet/#person' },
    }),
    expect.objectContaining({
      '@type': 'Person',
      '@id': 'https://27pm.org/auteurs/alexis-boulet/#person',
      name: 'Alexis Boulet',
      jobTitle: 'Fondateur de 27PM',
    }),
  ]));

  await page.goto('/services/agence-web/');
  const byline = page.locator('.editorial-byline');
  await expect(byline).toContainText('Mis à jour le 9 octobre 2026');
  await expect(byline.getByRole('link', { name: 'Alexis Boulet' })).toHaveAttribute(
    'href',
    '/auteurs/alexis-boulet/',
  );
});

test('keeps every detail page inside a 320px viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only assertion');
  await page.setViewportSize({ width: 320, height: 844 });
  for (const [path] of pages) {
    await page.goto(path);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `Horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
});
