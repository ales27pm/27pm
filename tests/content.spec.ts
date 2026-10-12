import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const pages = [
  ['/services/creation-sites-web/', 'Création de sites web au Québec pour les PME'],
  ['/services/agence-web/', 'Agence web au Québec : conception, refonte et développement'],
  ['/services/refonte-site-web/', 'Refonte de site web au Québec : préserver vos acquis'],
  ['/services/sites-catalogues-fabricants/', 'Sites web et catalogues pour fabricants québécois'],
  ['/services/applications-web-sur-mesure/', 'Applications web sur mesure pour PME au Québec'],
  ['/services/automatisation-ia/', 'Automatisation et IA pour PME au Québec'],
  ['/auteurs/alexis-boulet/', 'Alexis Boulet, fondateur de 27PM'],
  ['/ressources/checklist-fin-projet-web/', 'Checklist de fin de projet web : garder le contrôle'],
  ['/ressources/barometre-consentement-2026/', 'Le droit de refuser fonctionne-t-il au clavier?'],
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

test('publishes the reviewed consent barometer and aggregate downloads', async ({ page, request }) => {
  await page.goto('/ressources/barometre-consentement-2026/');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'index, follow');
  const publicationNotice = page.locator('[data-results-status="published"][data-publication-ready="true"][data-release-status="published"]');
  await expect(publicationNotice).toContainText('Publication révisée — données agrégées seulement');
  const results = page.locator('[data-results-reviewed]');
  await expect(results).toContainText('20 des 53 pages analysables, soit 37,7');
  await expect(results).toContainText('17 présentaient exactement une action de refus reconnue au premier niveau, soit 85');
  await expect(results).toContainText('14/15 déterminables (93,3');
  await expect(results).toContainText('2 indéterminés');
  await expect(results).not.toContainText(/55 pages|19 sur 55|16 sur 19|13 sur 16/);

  const csvLink = page.getByRole('link', { name: 'Télécharger les huit agrégats en CSV' });
  await expect(csvLink).toHaveAttribute('href', '/ressources/barometre-consentement-2026-agregats.csv');
  const csvResponse = await request.get('/ressources/barometre-consentement-2026-agregats.csv');
  expect(csvResponse.status()).toBe(200);
  const csv = await csvResponse.text();
  const csvRows = csv.split(/\r?\n/).filter(Boolean);
  expect(csvRows).toHaveLength(9);
  expect(csvRows[0]).toBe('metric_id,denominator_n,measured_n,missing_n,count,pct,median,p25,p75,min,max');
  expect(csvRows.at(-1)).toBe('reject_action_closed,17,15,2,14,93.3,,,,,');

  const pdfLink = page.getByRole('link', { name: 'Télécharger la publication permanente en PDF' });
  await expect(pdfLink).toHaveAttribute('href', '/ressources/barometre-consentement-2026.pdf');
  const pdfResponse = await request.get('/ressources/barometre-consentement-2026.pdf');
  expect(pdfResponse.status()).toBe(200);
  expect(pdfResponse.headers()['content-type']).toContain('application/pdf');
  expect((await pdfResponse.body()).subarray(0, 5).toString('ascii')).toBe('%PDF-');

  const jsonLink = page.getByRole('link', { name: 'Télécharger la méthode et les agrégats en JSON' });
  await expect(jsonLink).toHaveAttribute('href', '/ressources/barometre-consentement-2026.json');
  const jsonResponse = await request.get('/ressources/barometre-consentement-2026.json');
  expect(jsonResponse.status()).toBe(200);
  expect(jsonResponse.headers()['content-type']).toContain('application/json');
  const dataset = await jsonResponse.json();
  expect(dataset).toEqual(expect.objectContaining({
    schema_version: '1.0',
    resource_version: '0.1.2',
    status: 'published',
    date_published: '2026-10-11',
    date_modified: '2026-10-11',
    id: 'https://27pm.org/ressources/barometre-consentement-2026/#dataset',
    canonical_url: 'https://27pm.org/ressources/barometre-consentement-2026/',
  }));
  expect(dataset.scope).toEqual(expect.objectContaining({
    status: 'observed',
    sampled_homepages_n: 60,
    http_responded_n: 59,
    analyzable_homepages_n: 53,
    not_analyzable_n: 7,
  }));
  expect(dataset.license).toEqual({
    identifier: 'CC-BY-4.0',
    name: 'Creative Commons Attribution 4.0 International',
    url: 'https://creativecommons.org/licenses/by/4.0/',
    applies_to: ['article_text', 'results_infographic', 'archival_pdf', 'aggregate_csv', 'public_json'],
    attribution: 'Alexis Boulet et 27PM',
    attribution_url: 'https://27pm.org/ressources/barometre-consentement-2026/',
    excludes: ['rest_of_site', 'source_code', 'trademarks_and_logos', 'private_observations', 'source_dataset_rights'],
  });
  expect(dataset.publication_policy).toEqual(expect.objectContaining({
    observations_published: false,
    status: 'published',
    content_reviewed: true,
    release_approved: true,
    publishable: true,
    published: true,
    results_status: 'reviewed',
  }));
  expect(dataset.metric_definitions).toHaveLength(8);
  expect(dataset.aggregates).toHaveLength(8);
  expect(dataset.aggregates).toEqual(expect.arrayContaining([
    expect.objectContaining({ metric_id: 'banner_detected', denominator_n: 53, measured_n: 53, count: 20, pct: 37.7 }),
    expect.objectContaining({ metric_id: 'reject_first_layer', denominator_n: 20, measured_n: 20, count: 17, pct: 85 }),
    expect.objectContaining({ metric_id: 'keyboard_reject_steps', denominator_n: 17, measured_n: 17, median: 3, p25: 3, p75: 4, min: 2, max: 39 }),
    expect.objectContaining({ metric_id: 'reject_action_closed', denominator_n: 17, measured_n: 15, missing_n: 2, count: 14, pct: 93.3 }),
  ]));
  expect(dataset).not.toHaveProperty('observations');
  expect(dataset.scope).not.toHaveProperty('selected_homepages_n');
  expect(dataset.scope).not.toHaveProperty('analyzed_homepages_n');
  expect(dataset.scope).not.toHaveProperty('not_analyzed_n');
  expect(JSON.stringify(dataset)).not.toContain('selection_seed');
  expect(JSON.stringify(dataset)).not.toContain('git_sha');
  for (const excludedMetric of [
    'dialog_accessible_name',
    'privacy_link_in_banner',
    'third_party_origins_after_reject_count',
    'cookies_after_reject_count',
    'storage_items_after_reject_count',
    'focus_visible',
    'mobile_overflow_px',
  ]) {
    expect(JSON.stringify(dataset)).not.toContain(excludedMetric);
    expect(csv).not.toContain(excludedMetric);
  }

  const graph = JSON.parse(
    (await page.locator('script[type="application/ld+json"]').textContent()) ?? '{}',
  )['@graph'];
  expect(graph).toEqual(expect.arrayContaining([
    expect.objectContaining({
      '@type': 'Organization',
      '@id': 'https://27pm.org/#organization',
      name: '27PM',
    }),
    expect.objectContaining({ '@type': 'WebPage' }),
    expect.objectContaining({
      '@type': ['Article', 'TechArticle'],
      identifier: 'https://doi.org/10.5281/zenodo.23307073',
      sameAs: 'https://zenodo.org/records/23307073',
      license: 'https://creativecommons.org/licenses/by/4.0/',
      image: expect.objectContaining({
        license: 'https://creativecommons.org/licenses/by/4.0/',
        acquireLicensePage: 'https://27pm.org/ressources/barometre-consentement-2026/',
        copyrightNotice: '© 2026 Alexis Boulet et 27PM',
        creditText: 'Alexis Boulet et 27PM',
        creator: {
          '@type': 'Person',
          '@id': 'https://27pm.org/auteurs/alexis-boulet/#person',
          name: 'Alexis Boulet',
        },
      }),
    }),
    expect.objectContaining({
      '@type': 'Dataset',
      '@id': dataset.id,
      datePublished: '2026-10-11',
      version: '0.1.2',
      license: 'https://creativecommons.org/licenses/by/4.0/',
      publisher: { '@id': 'https://27pm.org/#organization' },
      distribution: expect.arrayContaining([
        expect.objectContaining({
          encodingFormat: 'application/pdf',
          contentUrl: 'https://27pm.org/ressources/barometre-consentement-2026.pdf',
          license: 'https://creativecommons.org/licenses/by/4.0/',
        }),
        expect.objectContaining({
          encodingFormat: 'text/csv',
          license: 'https://creativecommons.org/licenses/by/4.0/',
        }),
        expect.objectContaining({
          encodingFormat: 'application/json',
          license: 'https://creativecommons.org/licenses/by/4.0/',
        }),
      ]),
    }),
  ]));
  expect(graph.find((item: { '@type': string }) => item['@type'] === 'WebPage')).not.toHaveProperty('license');
  expect(graph.find((item: { '@type': string }) => item['@type'] === 'Organization')).not.toHaveProperty('license');
  expect(graph.some((item: { '@type': string; license?: string }) => (
    item['@type'] === 'WebSite' && Boolean(item.license)
  ))).toBe(false);
  for (const node of graph.filter((item: { '@type': string | string[] }) => (
    item['@type'] === 'WebPage'
    || item['@type'] === 'Dataset'
    || (Array.isArray(item['@type']) && item['@type'].includes('Article'))
  ))) {
    expect(node).not.toHaveProperty('creativeWorkStatus');
  }

  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    'https://27pm.org/assets/barometre-consentement-2026-resultats-1200x630.png',
  );
  await expect(page.locator('a[rel~="license"]')).toHaveAttribute(
    'href',
    'https://creativecommons.org/licenses/by/4.0/',
  );
  await expect(page.locator('a[rel~="license"]')).toHaveText(
    'Creative Commons Attribution 4.0 International (CC BY 4.0)',
  );
  await expect(page.getByRole('link', { name: '10.5281/zenodo.23307073' })).toHaveAttribute(
    'href',
    'https://doi.org/10.5281/zenodo.23307073',
  );
  const imageResponse = await request.get('/assets/barometre-consentement-2026-resultats-1200x630.png');
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()['content-type']).toContain('image/png');
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
