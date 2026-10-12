import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit', route => route.fulfill({
    contentType: 'application/javascript',
    body: `window.turnstile={render(_c,o){queueMicrotask(()=>o.callback('test-token'));return 'widget'},reset(){}};`,
  }));
});

test('carries lab choices into an editable brief without sending or persisting them', async ({ page }) => {
  let posts = 0;
  await page.route('https://api.crm.27pm.org/api/public/intake', route => { posts++; return route.abort(); });
  await page.goto('/');
  await page.getByLabel('Simplifier un processus interne', { exact: true }).check();
  await page.getByLabel('Portail client', { exact: true }).check();
  await page.getByLabel('Règles métier, sans IA', { exact: true }).check();
  await page.getByRole('link', { name: 'Discuter de ce scénario' }).click();
  const brief = page.getByLabel('Votre projet', { exact: true });
  await expect(brief).toHaveValue(/Besoin : Simplifier un processus interne/);
  await expect(brief).toHaveValue(/Piste explorée : Portail client/);
  await expect(brief).toHaveValue(/Capacité : Règles métier, sans IA/);
  await expect(page.getByLabel('Une application', { exact: true })).toBeChecked();
  await brief.fill(`${await brief.inputValue()} Notre équipe traite les demandes à la main.`);
  await expect(page.locator('[data-project-mail]')).toHaveAttribute('href', /Notre%20%C3%A9quipe/);
  expect(posts).toBe(0);
  const storage = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage } }));
  expect(JSON.stringify(storage)).not.toContain('Portail client');
  expect(JSON.stringify(storage)).not.toContain('Notre équipe');
  await page.reload();
  await expect(brief).toHaveValue('');
});

test('does not overwrite existing writing or append a scenario twice', async ({ page }) => {
  await page.goto('/#contact');
  const brief = page.getByLabel('Votre projet', { exact: true });
  await brief.fill('Mon contexte personnel à conserver.');
  await page.getByRole('link', { name: 'Discuter de ce scénario' }).click();
  await expect(brief).toHaveValue('Mon contexte personnel à conserver.');
  await expect(page.locator('[data-brief-proposal]')).toBeVisible();
  await page.getByRole('button', { name: 'Ignorer cette proposition' }).click();
  await expect(brief).toHaveValue('Mon contexte personnel à conserver.');
  await page.getByRole('link', { name: 'Discuter de ce scénario' }).click();
  await page.getByRole('button', { name: 'Ajouter à mon brouillon' }).click();
  const combined = await brief.inputValue();
  expect(combined).toMatch(/^Mon contexte personnel à conserver\./);
  expect(combined).toContain('Source : laboratoire');
  await page.getByRole('link', { name: 'Discuter de ce scénario' }).click();
  await expect(brief).toHaveValue(combined);
  await expect(page.locator('[data-brief-proposal]')).toBeHidden();
});

const sources = [
  ['services/creation-sites-web', 'création de site web', 'Un site web'],
  ['services/agence-web', 'accompagnement par une agence web', 'Je ne sais pas encore'],
  ['services/refonte-site-web', 'refonte de site web', 'Un site web'],
  ['services/sites-catalogues-fabricants', 'sites et catalogues pour fabricants', 'Un site web'],
  ['services/applications-web-sur-mesure', 'application web sur mesure', 'Une application'],
  ['services/automatisation-ia', 'automatisation ou outil d’IA', 'Automatisation ou IA'],
  ['ressources/checklist-fin-projet-web', 'checklist de fin de projet web', 'Un site web'],
  ['ressources/barometre-consentement-2026', 'baromètre du consentement 2026', 'Un site web'],
];
for (const [path, subject, category] of sources) {
  test(`contextualizes contact from ${path}`, async ({ page }) => {
    let posts = 0;
    await page.route('https://api.crm.27pm.org/api/public/intake', route => { posts++; return route.abort(); });
    await page.goto(`/${path}/`);
    await page.locator('.editorial-actions a[href$="#contact"]').click();
    await expect(page.getByLabel('Votre projet', { exact: true })).toHaveValue(new RegExp(subject ?? ''));
    await expect(page.getByLabel(category ?? '', { exact: true })).toBeChecked();
    await expect(page).toHaveURL(/\/#contact$/);
    expect(posts).toBe(0);
  });
}

test('ignores an unknown source instead of echoing URL input into the form', async ({ page }) => {
  await page.goto('/?demande=private%40example.test#contact');
  await expect(page.getByLabel('Votre projet', { exact: true })).toHaveValue('');
  await expect(page).toHaveURL(/\/#contact$/);
});

test('submits only the edited contextual brief on an explicit request', async ({ page }) => {
  test.skip(process.env.CRM_TEST_PROFILE !== 'approved', 'Requires the approved CRM build.');
  const payloads: Record<string, unknown>[] = [];
  await page.route('https://api.crm.27pm.org/api/public/intake', route => {
    payloads.push(route.request().postDataJSON() as Record<string, unknown>);
    return route.fulfill({ status: 202 });
  });
  await page.goto('/?demande=automatisation#contact');
  const brief = page.getByLabel('Votre projet', { exact: true });
  const edited = `${await brief.inputValue()} Nous voulons relier la réception à la facturation.`;
  await brief.fill(edited);
  await page.getByLabel('Votre organisation', { exact: true }).fill('Atelier QA');
  await page.getByLabel('Votre nom', { exact: true }).fill('Alex QA');
  await page.getByLabel('Votre courriel', { exact: true }).fill('QA@example.test');
  await page.getByLabel(/J’ai pris connaissance/).check();
  expect(payloads).toHaveLength(0);
  await page.locator('[data-crm-submit]').click();
  await expect(page.locator('[data-project-status]')).toContainText('Réception confirmée');
  expect(payloads).toHaveLength(1);
  expect(payloads[0]).toEqual({
    organizationName: 'Atelier QA', contactName: 'Alex QA', contactEmail: 'qa@example.test',
    projectType: 'automation', message: edited.trim(), privacyAcknowledged: true,
    turnstileToken: 'test-token', website: '',
  });
});

test('keeps all writing when appending makes the brief exceed its limit', async ({ page }) => {
  await page.goto('/#contact');
  const brief = page.getByLabel('Votre projet', { exact: true });
  const original = 'x'.repeat(4950);
  await brief.fill(original);
  await page.getByRole('link', { name: 'Discuter de ce scénario' }).click();
  const proposed = await page.locator('[data-brief-proposal-text]').innerText();
  await page.getByRole('button', { name: 'Ajouter à mon brouillon' }).click();
  const result = await brief.inputValue();
  expect(result).toBe(`${original}\n\n${proposed}`);
  expect(result.length).toBeGreaterThan(5000);
  await expect(page.locator('[data-brief-length]')).toContainText('dépasse la limite');
  await expect(page.locator('[data-project-mail]')).not.toHaveAttribute('href');
});

test('offers an accessible proposal and keyboard continuation without sending', async ({ page }) => {
  await page.goto('/#contact');
  const brief = page.getByLabel('Votre projet', { exact: true });
  await brief.fill('Notre contexte.');
  const link = page.getByRole('link', { name: 'Discuter de ce scénario' });
  await link.focus();
  await link.press('Enter');
  const add = page.getByRole('button', { name: 'Ajouter à mon brouillon' });
  await expect(add).toBeFocused();
  const results = await new AxeBuilder({ page }).include('#contact').analyze();
  expect(results.violations).toEqual([]);
  await add.press('Enter');
  await expect(brief).toBeFocused();
  await expect(brief).toHaveValue(/^Notre contexte\.[\s\S]*Source : laboratoire/);
});

for (const allowed of [true, false]) {
  test(`copies the edited brief or selects it when clipboard allowed=${allowed}`, async ({ page }) => {
    await page.addInitScript(canCopy => {
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
        writeText: async (value: string) => {
          if (!canCopy) throw new Error('Clipboard unavailable');
          (window as typeof window & { copiedBrief?: string }).copiedBrief = value;
        },
      } });
    }, allowed);
    await page.goto('/?demande=checklist#contact');
    const brief = page.getByLabel('Votre projet', { exact: true });
    const expected = `${await brief.inputValue()} Nos accès sont à vérifier.`;
    await brief.fill(expected);
    await page.getByRole('button', { name: 'Copier mon brouillon' }).click();
    if (allowed) {
      await expect(page.locator('[data-copy-brief-status]')).toHaveText('Brouillon copié.');
      expect(await page.evaluate(() => (window as typeof window & { copiedBrief?: string }).copiedBrief)).toBe(expected);
    } else {
      await expect(page.locator('[data-copy-brief-status]')).toContainText('Copie indisponible');
      await expect(brief).toBeFocused();
      expect(await brief.evaluate((field: HTMLTextAreaElement) => field.value.slice(field.selectionStart, field.selectionEnd))).toBe(expected);
    }
  });
}
