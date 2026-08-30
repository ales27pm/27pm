import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/newsreader';
import './styles.css';
import { initializeInactiveAnalyticsControls } from './analytics-inactive';
import {
  buildProjectMailto,
  copyEmailAddress,
  isProjectKind,
  type ProjectBrief,
  type ProjectKind,
} from './contact';

document.documentElement.classList.add('js');
if (import.meta.env.VITE_ANALYTICS_APPROVED === 'true') {
  void import('./analytics').then(({ initializeAnalyticsConsent }) => {
    initializeAnalyticsConsent({ enabled: true });
  });
} else {
  initializeInactiveAnalyticsControls();
}

const menuButton = document.querySelector<HTMLButtonElement>('[data-menu-button]');
const menuLabel = document.querySelector<HTMLElement>('[data-menu-label]');
const navigation = document.querySelector<HTMLElement>('[data-navigation]');
const pageMain = document.querySelector<HTMLElement>('main');
const siteFooter = document.querySelector<HTMLElement>('.site-footer');
const mobileMenu = window.matchMedia('(max-width: 1100px)');

function menuIsOpen(): boolean {
  return menuButton?.getAttribute('aria-expanded') === 'true';
}

function syncNavigationState(open: boolean): void {
  if (!menuButton || !navigation) return;

  const mobileOpen = mobileMenu.matches && open;
  menuButton.setAttribute('aria-expanded', String(mobileOpen));
  if (menuLabel) menuLabel.textContent = mobileOpen ? 'Fermer' : 'Menu';
  navigation.dataset.open = String(mobileOpen);
  document.body.classList.toggle('menu-open', mobileOpen);
  if (pageMain) pageMain.inert = mobileOpen;
  if (siteFooter) siteFooter.inert = mobileOpen;

  if (mobileMenu.matches) {
    navigation.inert = !mobileOpen;
    navigation.setAttribute('aria-hidden', String(!mobileOpen));
  } else {
    navigation.inert = false;
    navigation.removeAttribute('aria-hidden');
  }
}

menuButton?.addEventListener('click', () => syncNavigationState(!menuIsOpen()));
navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => syncNavigationState(false));
});

document.addEventListener('keydown', (event) => {
  if (!mobileMenu.matches || !menuIsOpen() || !menuButton || !navigation) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    syncNavigationState(false);
    menuButton.focus();
    return;
  }

  if (event.key !== 'Tab') return;

  const navigationLinks = [...navigation.querySelectorAll<HTMLAnchorElement>('a[href]')];
  const lastLink = navigationLinks.at(-1);

  if (event.shiftKey && document.activeElement === menuButton && lastLink) {
    event.preventDefault();
    lastLink.focus();
  } else if (!event.shiftKey && document.activeElement === lastLink) {
    event.preventDefault();
    menuButton.focus();
  }
});

mobileMenu.addEventListener('change', () => syncNavigationState(false));
syncNavigationState(false);

type CapabilityId = 'convaincre' | 'simplifier' | 'inventer';

interface CapabilityProof {
  title: string;
  items: string[];
  summary: string;
  image?: {
    src: string;
    alt: string;
  };
}

const capabilities: Record<CapabilityId, CapabilityProof> = {
  convaincre: {
    title: 'Offre complexe',
    items: [
      'Produits multiples',
      'Plusieurs publics',
      'Normes et contraintes',
      'Processus manuels',
      'Données éparpillées',
    ],
    summary: 'Une offre complexe devient un parcours clair qui mène à l’action.',
    image: {
      src: 'assets/projects/portes-fenetres-boulet.webp',
      alt: 'Aperçu du concept Portes et Fenêtres Boulet',
    },
  },
  simplifier: {
    title: 'Opération fragmentée',
    items: [
      'Demandes dispersées',
      'Suivis manuels',
      'Données dupliquées',
      'Décisions tardives',
      'Outils déconnectés',
    ],
    summary: 'Un système relie les choix, les données et le suivi au même endroit.',
    image: {
      src: 'assets/projects/maisons-s-turner.webp',
      alt: 'Aperçu du concept Maisons S. Turner',
    },
  },
  inventer: {
    title: 'Possibilité à valider',
    items: [
      'Besoin réel',
      'Usage à clarifier',
      'Données disponibles',
      'Hypothèses à tester',
      'Risque à réduire',
    ],
    summary: 'Un prototype concret rend une idée testable avant d’investir plus loin.',
  },
};

const capabilityButtons = [
  ...document.querySelectorAll<HTMLButtonElement>('[data-capability]'),
];
const proof = document.querySelector<HTMLElement>('[data-capability-proof]');
const proofTitle = document.querySelector<HTMLElement>('[data-proof-title]');
const proofItems = document.querySelector<HTMLUListElement>('[data-proof-items]');
const proofSummary = document.querySelector<HTMLElement>('[data-proof-summary]');
const proofImage = document.querySelector<HTMLImageElement>('[data-proof-image]');
const proofPrototype = document.querySelector<HTMLElement>('[data-proof-prototype]');

function isCapabilityId(value: string | undefined): value is CapabilityId {
  return value === 'convaincre' || value === 'simplifier' || value === 'inventer';
}

function selectCapability(id: CapabilityId, focus = false): void {
  const selected = capabilities[id];
  capabilityButtons.forEach((button) => {
    const active = button.dataset.capability === id;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
    if (active && focus) button.focus();
  });

  if (proof) proof.dataset.proofMode = id;
  if (proofTitle) proofTitle.textContent = selected.title;
  if (proofItems) {
    proofItems.replaceChildren(
      ...selected.items.map((item) => {
        const row = document.createElement('li');
        row.textContent = item;
        return row;
      }),
    );
  }
  if (proofSummary) proofSummary.textContent = selected.summary;

  const hasImage = Boolean(selected.image);
  if (proofImage) {
    proofImage.hidden = !hasImage;
    if (selected.image) {
      proofImage.src = `${import.meta.env.BASE_URL}${selected.image.src}`;
      proofImage.alt = selected.image.alt;
    }
  }
  if (proofPrototype) proofPrototype.hidden = hasImage;
}

capabilityButtons.forEach((button, index) => {
  button.addEventListener('click', () => {
    if (isCapabilityId(button.dataset.capability)) selectCapability(button.dataset.capability);
  });
  button.addEventListener('keydown', (event) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
    const next = capabilityButtons.at((index + direction + capabilityButtons.length) % capabilityButtons.length);
    if (next && isCapabilityId(next.dataset.capability)) selectCapability(next.dataset.capability, true);
  });
});

selectCapability('convaincre');

const scenarioForm = document.querySelector<HTMLFormElement>('[data-scenario-form]');
const scenarioTitle = document.querySelector<HTMLElement>('[data-scenario-title]');
const scenarioPoints = document.querySelector<HTMLUListElement>('[data-scenario-points]');
const scenarioResult = document.querySelector<HTMLElement>('[data-scenario-result]');

const needOptions = {
  qualifier: {
    outcome: 'transforme les visiteurs en demandes qualifiées',
    point: 'Qualification progressive',
  },
  commerce: {
    outcome: 'guide la découverte jusqu’à une commande claire',
    point: 'Parcours de vente structuré',
  },
  operations: {
    outcome: 'réunit les étapes d’un processus interne',
    point: 'Opérations simplifiées',
  },
  data: {
    outcome: 'structure les données pour les rendre exploitables',
    point: 'Données cohérentes',
  },
} as const;

const interfaceOptions = {
  editorial: { label: 'site éditorial', point: 'Parcours éditorial' },
  portal: { label: 'portail client', point: 'Espace client sécurisé' },
  configurator: { label: 'configurateur', point: 'Choix guidés' },
  dashboard: { label: 'tableau de bord', point: 'Vue opérationnelle' },
} as const;

const intelligenceOptions = {
  rules: {
    phrase: 'avec des règles métier explicites, sans IA superflue',
    point: 'Règles métier vérifiables',
  },
  semantic: {
    phrase: 'et retrouve le bon contenu par le sens',
    point: 'Recherche sémantique',
  },
  recommendation: {
    phrase: 'et recommande le bon parcours',
    point: 'Recommandations contextualisées',
  },
  assistant: {
    phrase: 'avec un assistant conversationnel encadré',
    point: 'Assistant avec garde-fous',
  },
} as const;

type NeedId = keyof typeof needOptions;
type InterfaceId = keyof typeof interfaceOptions;
type IntelligenceId = keyof typeof intelligenceOptions;

function checkedScenarioValue(name: string): string | undefined {
  return scenarioForm?.querySelector<HTMLInputElement>(`input[name="${name}"]:checked`)?.value;
}

function updateScenario(): void {
  if (!scenarioForm || !scenarioTitle || !scenarioPoints) return;

  const needId = checkedScenarioValue('scenario-need') as NeedId | undefined;
  const interfaceId = checkedScenarioValue('scenario-interface') as InterfaceId | undefined;
  const intelligenceId = checkedScenarioValue('scenario-intelligence') as IntelligenceId | undefined;
  if (!needId || !interfaceId || !intelligenceId) return;

  const need = needOptions[needId];
  const surface = interfaceOptions[interfaceId];
  const intelligence = intelligenceOptions[intelligenceId];
  scenarioTitle.textContent = `Un ${surface.label} qui ${need.outcome} ${intelligence.phrase}.`;
  scenarioPoints.replaceChildren(
    ...[surface.point, need.point, intelligence.point, 'Suivi structuré'].map((item) => {
      const row = document.createElement('li');
      row.textContent = item;
      return row;
    }),
  );

  if (scenarioResult) {
    scenarioResult.dataset.updated = 'true';
    window.setTimeout(() => delete scenarioResult.dataset.updated, 360);
  }
}

scenarioForm?.addEventListener('change', updateScenario);
scenarioForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  updateScenario();
});
updateScenario();

const projectOptions = [...document.querySelectorAll<HTMLInputElement>('input[name="project"]')];
const mailLink = document.querySelector<HTMLAnchorElement>('[data-project-mail]');
const projectStatus = document.querySelector<HTMLElement>('[data-project-status]');
const contactForm = document.querySelector<HTMLFormElement>('[data-contact-form]');
const contactContext = document.querySelector<HTMLTextAreaElement>('[data-contact-context]');
const contactName = document.querySelector<HTMLInputElement>('[data-contact-name]');
const contactReply = document.querySelector<HTMLInputElement>('[data-contact-reply]');
let selectedProject: ProjectKind = 'site';

function currentBrief(): ProjectBrief {
  return {
    context: contactContext?.value,
    name: contactName?.value,
    replyEmail: contactReply?.value,
  };
}

function syncMailLink(): void {
  if (mailLink) mailLink.href = buildProjectMailto(selectedProject, currentBrief());
}

function selectProject(project: ProjectKind, announce = false): void {
  const option = projectOptions.find((item) => item.value === project);
  if (!option) return;

  selectedProject = project;
  option.checked = true;
  document.querySelectorAll<HTMLElement>('[data-project-option]').forEach((label) => {
    label.classList.toggle('is-selected', label.dataset.projectOption === project);
  });
  syncMailLink();

  if (announce && projectStatus) {
    projectStatus.textContent = `Choix sélectionné : ${option.dataset.label ?? option.value}.`;
  }
}

projectOptions.forEach((option) => {
  option.addEventListener('change', () => {
    if (isProjectKind(option.value)) selectProject(option.value, true);
  });
});

[contactContext, contactName, contactReply].forEach((input) => {
  input?.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    syncMailLink();
  });
});

mailLink?.addEventListener('click', (event) => {
  if (!contactContext?.value.trim()) {
    event.preventDefault();
    contactContext?.setAttribute('aria-invalid', 'true');
    if (projectStatus) projectStatus.textContent = 'Décrivez brièvement votre projet avant de préparer le courriel.';
    contactContext?.focus();
    return;
  }

  if (contactReply?.value && !contactReply.checkValidity()) {
    event.preventDefault();
    contactReply.setAttribute('aria-invalid', 'true');
    if (projectStatus) projectStatus.textContent = 'Vérifiez le format du courriel indiqué.';
    contactReply.focus();
    return;
  }

  syncMailLink();
  if (projectStatus) projectStatus.textContent = 'Le courriel est prêt à ouvrir.';
});

contactForm?.addEventListener('submit', (event) => {
  event.preventDefault();
  mailLink?.click();
});

selectProject('site');

const contactEmail = document.querySelector<HTMLAnchorElement>('[data-contact-email]');
const copyEmailButton = document.querySelector<HTMLButtonElement>('[data-copy-email]');
const copyEmailStatus = document.querySelector<HTMLElement>('[data-copy-email-status]');

if (contactEmail && copyEmailButton && copyEmailStatus) {
  copyEmailButton.addEventListener('click', async () => {
    const email = (contactEmail.textContent ?? '').trim();
    const writeText = navigator.clipboard?.writeText.bind(navigator.clipboard);
    const copied = await copyEmailAddress(email, writeText);

    copyEmailStatus.textContent = copied
      ? 'Adresse copiée.'
      : 'Copie impossible. Sélectionnez l’adresse affichée.';
    if (!copied) contactEmail.focus();
  });
}

const heroVectors = document.querySelector<SVGGElement>('[data-field-vectors]');
if (heroVectors) {
  const namespace = 'http://www.w3.org/2000/svg';
  const fragment = document.createDocumentFragment();
  const focus = { x: 610, y: 338 };

  for (let row = 0; row < 23; row += 1) {
    for (let column = 0; column < 34; column += 1) {
      const x = 18 + column * 26;
      const y = 48 + row * 28;
      const deltaX = x - focus.x;
      const deltaY = y - focus.y;
      const distance = Math.hypot(deltaX, deltaY);
      const angle = Math.atan2(deltaY, deltaX) + Math.PI / 2 + Math.sin(distance * 0.018) * 0.34;
      const length = 7 + Math.min(10, distance / 50);
      const halfX = Math.cos(angle) * length * 0.5;
      const halfY = Math.sin(angle) * length * 0.5;
      const vector = document.createElementNS(namespace, 'line');

      vector.setAttribute('x1', (x - halfX).toFixed(1));
      vector.setAttribute('y1', (y - halfY).toFixed(1));
      vector.setAttribute('x2', (x + halfX).toFixed(1));
      vector.setAttribute('y2', (y + halfY).toFixed(1));
      vector.setAttribute('opacity', (0.14 + Math.max(0, 1 - distance / 620) * 0.48).toFixed(2));
      fragment.append(vector);
    }
  }

  heroVectors.append(fragment);
}

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const heroVisual = document.querySelector<HTMLElement>('[data-hero-visual]');

if (heroVisual && !prefersReducedMotion) {
  heroVisual.addEventListener('pointermove', (event) => {
    const bounds = heroVisual.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width - 0.5;
    const y = (event.clientY - bounds.top) / bounds.height - 0.5;
    heroVisual.style.setProperty('--hero-x', x.toFixed(3));
    heroVisual.style.setProperty('--hero-y', y.toFixed(3));
  });
  heroVisual.addEventListener('pointerleave', () => {
    heroVisual.style.setProperty('--hero-x', '0');
    heroVisual.style.setProperty('--hero-y', '0');
  });
}

const sectionLinks = [
  ...document.querySelectorAll<HTMLAnchorElement>('.site-nav > a[href^="#"]:not(.button)'),
];
const observedSections = sectionLinks
  .map((link) => {
    const section = document.getElementById(link.hash.slice(1));
    return section ? { link, section } : null;
  })
  .filter((entry): entry is { link: HTMLAnchorElement; section: HTMLElement } => entry !== null);

if ('IntersectionObserver' in window) {
  const navigationObserver = new IntersectionObserver(
    (entries) => {
      const activeEntry = entries.find((entry) => entry.isIntersecting);
      if (!activeEntry) return;

      observedSections.forEach(({ link, section }) => {
        const isCurrent = section === activeEntry.target;
        link.toggleAttribute('data-current', isCurrent);
        if (isCurrent) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      });
    },
    { rootMargin: '-32% 0px -58% 0px', threshold: 0 },
  );
  observedSections.forEach(({ section }) => navigationObserver.observe(section));
}

const revealItems = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];
if (prefersReducedMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).classList.add('is-visible');
        revealObserver.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -7% 0px', threshold: 0.06 },
  );
  revealItems.forEach((item) => revealObserver.observe(item));
}
document.documentElement.classList.add('reveal-ready');

document.querySelectorAll<HTMLElement>('[data-year]').forEach((item) => {
  item.textContent = String(new Date().getFullYear());
});
