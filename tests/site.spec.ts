import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('renders the complete French landing page', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('27PM | Sites web et applications sur mesure');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Clair pour\s+vos clients\.\s+Solide pour vous\./);
  await expect(page.getByRole('heading', { name: 'Ce qu’on bâtit, avec vous.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Du concret, mis en ligne.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Portes et Fenêtres Boulet' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Maisons S. Turner' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'De l’idée à l’impact, sans détour.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Petit studio. Grande attention.' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'On commence par une conversation.' })).toBeVisible();
});

test('publishes real previews without exposing private portfolio links', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('a[href*=".ts.net"]')).toHaveCount(0);

  const turnerLinks = page.locator('a[data-public-project][href="https://maisonsturner.ca/"]');
  await expect(turnerLinks).toHaveCount(2);
  for (const link of await turnerLinks.all()) {
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', /noopener/);
  }

  await expect(page.getByRole('link', { name: 'Visiter le site public · nouvel onglet' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Parler d’un projet semblable' })).toHaveAttribute('href', '#contact');

  const previews = page.locator('.work-visual img');
  await expect(previews).toHaveCount(2);
  await previews.last().scrollIntoViewIfNeeded();
  for (let index = 0; index < 2; index += 1) {
    await expect.poll(() => previews.nth(index).evaluate((image) => {
      const element = image as HTMLImageElement;
      return element.complete && element.naturalWidth === 1440;
    })).toBe(true);
  }
});

test('updates the contact action from the selected project', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Une application').check();

  const mailLink = page.getByRole('link', { name: /Ouvrir mon courriel/ });
  await expect(mailLink).toHaveAttribute('href', /Une%20application/);

  await page.locator('[data-select-project="produit"]').click();
  await expect(page.getByLabel('Un produit à clarifier')).toBeChecked();
  await expect(mailLink).toHaveAttribute('href', /Un%20produit%20%C3%A0%20clarifier/);
});

test('supports keyboard selection and announces the chosen project', async ({ page }) => {
  await page.goto('/');
  const siteOption = page.getByLabel('Un site web');
  const applicationOption = page.getByLabel('Une application');
  const status = page.locator('[data-project-status]');

  await siteOption.focus();
  await page.keyboard.press('ArrowDown');
  await expect(applicationOption).toBeChecked();
  await expect(status).toHaveText('Choix sélectionné : Une application.');
  await expect(page.getByRole('link', { name: 'Ouvrir mon courriel' })).toHaveAttribute('href', /Une%20application/);
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
  await page.goto('/');

  await expect(page.getByText('Quel type de projet souhaitez-vous réaliser?')).toBeVisible();
  await expect(page.getByText('Le bouton ouvre votre application de courriel avec un message préparé.')).toBeVisible();
  await expect(page.locator('[data-contact-email]')).toBeVisible();

  await page.getByRole('button', { name: 'Copier l’adresse' }).click();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('copied-email'))).toBe('bonjour@27pm.org');
  await expect(page.locator('[data-copy-email-status]')).toHaveText('Adresse copiée.');
});

test('keeps the address usable when clipboard access fails', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error('denied')) },
    });
  });
  await page.goto('/');

  const fallback = page.locator('[data-contact-email]');
  await page.getByRole('button', { name: 'Copier l’adresse' }).click();
  await expect(page.locator('[data-copy-email-status]')).toHaveText('Copie impossible. Sélectionnez l’adresse affichée.');
  await expect(fallback).toBeFocused();
});

test('has no automatically detectable accessibility violations on public pages', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });

  for (const path of ['/', '/confidentialite/', '/404.html']) {
    await page.goto(path, { waitUntil: 'networkidle' });
    const results = await new AxeBuilder({ page }).analyze();

    expect(results.violations, `Accessibility violations on ${path}`).toEqual([]);
  }
});

test('has no automatically detectable accessibility violations with the mobile menu open', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only assertion');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('loads the selected brand mark and keeps a keyboard skip link', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Aller au contenu' })).toBeFocused();

  const mark = page.locator('.studio-symbol img');
  await mark.scrollIntoViewIfNeeded();
  await expect.poll(() => mark.evaluate((image) => {
    const element = image as HTMLImageElement;
    return element.complete && element.naturalWidth === 1024 && element.naturalHeight === 1024;
  })).toBe(true);
});

test('publishes the complete v4 brand asset set', async ({ page, request }) => {
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
  const ogImage = page.locator('meta[property="og:image"]');
  await expect(ogImage).toHaveAttribute('content', 'https://27pm.org/assets/og-27pm-1200x630.png');
});

test('publishes a reachable privacy page', async ({ page }) => {
  await page.goto('/confidentialite/');

  await expect(page).toHaveTitle('Confidentialité | 27PM');
  await expect(page.getByRole('heading', { level: 1, name: 'Politique de confidentialité' })).toBeVisible();
  await expect(page.getByText('Responsable de la protection des renseignements personnels', { exact: true })).toBeVisible();
  await expect(page.getByText('GitHub Pages', { exact: true })).toBeVisible();
  await expect(page.getByText(/Selon le service d’hébergement retenu/)).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Retour au site' })).toHaveAttribute('href', '/');
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
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://27pm.org/assets/og-27pm-1200x630.png');
  await expect(page.getByRole('link', { name: 'Confidentialité' })).toHaveAttribute('href', '/confidentialite/');

  const organization = await page.locator('script[type="application/ld+json"]').textContent();
  expect(organization).not.toBeNull();
  expect(JSON.parse(organization ?? '{}')).toMatchObject({
    '@type': 'Organization',
    url: 'https://27pm.org/',
    email: 'bonjour@27pm.org',
  });

  const robots = await request.get('/robots.txt');
  expect(robots.ok()).toBe(true);
  expect(await robots.text()).toContain('Sitemap: https://27pm.org/sitemap.xml');

  const sitemap = await request.get('/sitemap.xml');
  expect(sitemap.ok()).toBe(true);
  expect(await sitemap.text()).toContain('<loc>https://27pm.org/confidentialite/</loc>');
});

test('keeps the page inside the mobile viewport', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Mobile-only assertion');
  await page.setViewportSize({ width: 320, height: 844 });

  for (const path of ['/', '/confidentialite/', '/404.html']) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
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
  await expect(page.getByRole('link', { name: /Parler de votre projet/ })).toBeFocused();

  await menu.click();
  await expect(navigation).not.toHaveAttribute('inert', '');
  await expect(navigation).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('main')).toHaveAttribute('inert', '');
  await expect(page.locator('footer')).toHaveAttribute('inert', '');
  await expect(menu).toHaveAccessibleName('Fermer');

  await menu.focus();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Expertise' })).toBeFocused();
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

test('switches to the compact navigation before the desktop hero becomes crowded', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.goto('/');

  await expect(page.getByRole('button', { name: /Menu/ })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

test('keeps the alternating portfolio composition at the approved 971px reference width', async ({ page }) => {
  await page.setViewportSize({ width: 971, height: 1000 });
  await page.goto('/');

  const firstCard = page.locator('.work-card').first();
  const secondCard = page.locator('.work-card').nth(1);
  const firstCopy = await firstCard.locator('.work-copy').boundingBox();
  const firstVisual = await firstCard.locator('.work-visual').boundingBox();
  const secondCopy = await secondCard.locator('.work-copy').boundingBox();
  const secondVisual = await secondCard.locator('.work-visual').boundingBox();

  expect(firstCopy).not.toBeNull();
  expect(firstVisual).not.toBeNull();
  expect(secondCopy).not.toBeNull();
  expect(secondVisual).not.toBeNull();
  expect(firstCopy!.x).toBeLessThan(firstVisual!.x);
  expect(secondVisual!.x).toBeLessThan(secondCopy!.x);
});

test('keeps the contact heading clear of the project choices at intermediate widths', async ({ page }) => {
  for (const width of [987, 1100, 1101, 1374]) {
    await page.setViewportSize({ width, height: 700 });
    await page.goto('/#contact');

    const geometry = await page.evaluate(() => {
      const heading = document.querySelector('.contact h2');
      const selector = document.querySelector('.project-selector');
      const lines = [...document.querySelectorAll('.contact h2 span')];

      if (!(heading instanceof HTMLElement) || !(selector instanceof HTMLElement) || lines.length === 0) {
        throw new Error('Contact geometry is unavailable');
      }

      const headingRect = heading.getBoundingClientRect();
      const selectorRect = selector.getBoundingClientRect();
      const textRight = Math.max(...lines.map((line) => {
        const range = document.createRange();
        range.selectNodeContents(line);
        return range.getBoundingClientRect().right;
      }));

      return {
        horizontalOverlap: selectorRect.top < headingRect.bottom
          ? Math.max(0, textRight - selectorRect.left)
          : 0,
        verticalOverlap: selectorRect.top >= headingRect.bottom
          ? Math.max(0, headingRect.bottom - selectorRect.top)
          : 0,
      };
    });

    expect(geometry.horizontalOverlap, `Horizontal contact overlap at ${width}px`).toBeLessThanOrEqual(1);
    expect(geometry.verticalOverlap, `Vertical contact overlap at ${width}px`).toBeLessThanOrEqual(1);
  }
});
