import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/newsreader';
import './styles.css';
import { initializeInactiveAnalyticsControls } from './analytics-inactive';
import {
  buildProjectMailto,
  copyEmailAddress,
  isProjectKind,
  isContactEmail,
  validateBriefLimits,
  type ProjectBrief,
  type ProjectKind,
} from './contact';
import {
  createIdempotencyKey,
  createPublicIntakePayload,
  intakeDraftIdentity,
  submitPublicIntake,
  TURNSTILE_ACTION,
  validatePublicIntakeDraft,
  type PublicIntakeDraft,
} from './crm-intake';
import { appendBrief, scenarioBrief, sourceBrief, type BriefSuggestion } from './discovery-brief';

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
const contactOrganization = document.querySelector<HTMLInputElement>('[data-contact-organization]');
const contactName = document.querySelector<HTMLInputElement>('[data-contact-name]');
const contactReply = document.querySelector<HTMLInputElement>('[data-contact-reply]');
const contactWebsite = document.querySelector<HTMLInputElement>('[data-contact-website]');
const contactPrivacy = document.querySelector<HTMLInputElement>('[data-contact-privacy]');
const crmIntake = document.querySelector<HTMLElement>('[data-crm-intake]');
const crmUnavailable = document.querySelector<HTMLElement>('[data-crm-unavailable]');
const crmSubmit = document.querySelector<HTMLButtonElement>('[data-crm-submit]');
const crmSubmitLabel = document.querySelector<HTMLElement>('[data-crm-submit-label]');
const crmRetry = document.querySelector<HTMLButtonElement>('[data-crm-retry]');
const briefLength = document.querySelector<HTMLElement>('[data-brief-length]');
const turnstileContainer = document.querySelector<HTMLElement>('[data-turnstile-widget]');
let selectedProject: ProjectKind = 'site';

function currentBrief(): ProjectBrief {
  return {
    context: contactContext?.value,
    organization: contactOrganization?.value,
    name: contactName?.value,
    replyEmail: contactReply?.value,
  };
}

function syncMailLink(): boolean {
  const brief = currentBrief();
  const error = Object.values(validateBriefLimits(brief))[0];
  if (briefLength) {
    briefLength.textContent = error ?? `${(brief.context ?? '').trim().length.toLocaleString('fr-CA')} / 5 000 caractères. Rien ne sera coupé automatiquement.`;
  }
  if (error) {
    mailLink?.removeAttribute('href');
    return false;
  }
  if (mailLink) mailLink.href = buildProjectMailto(selectedProject, brief);
  return true;
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
    setContactStatus(`Choix sélectionné : ${option.dataset.label ?? option.value}.`);
  }
}

projectOptions.forEach((option) => {
  option.addEventListener('change', () => {
    if (isProjectKind(option.value)) selectProject(option.value, true);
  });
});

[contactContext, contactOrganization, contactName, contactReply].forEach((input) => {
  input?.addEventListener('input', () => {
    input.removeAttribute('aria-invalid');
    syncMailLink();
  });
});

mailLink?.addEventListener('click', (event) => {
  if (!syncMailLink()) {
    event.preventDefault();
    setContactStatus(Object.values(validateBriefLimits(currentBrief()))[0] ?? 'Vérifiez la longueur du brouillon.', 'error');
    contactContext?.focus();
    return;
  }
  if (!contactContext?.value.trim()) {
    event.preventDefault();
    contactContext?.setAttribute('aria-invalid', 'true');
    setContactStatus('Décrivez brièvement votre projet avant de préparer le courriel.', 'error');
    contactContext?.focus();
    return;
  }

  if (contactReply?.value && !isContactEmail(contactReply.value)) {
    event.preventDefault();
    contactReply.setAttribute('aria-invalid', 'true');
    setContactStatus('Vérifiez le format du courriel indiqué.', 'error');
    contactReply.focus();
    return;
  }

  syncMailLink();
  setContactStatus('Le courriel est prêt à ouvrir. Son envoi reste à effectuer dans votre messagerie.');
});

selectProject('site');

interface TurnstileApi {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: 'light';
      size: 'flexible';
      language: 'fr';
      'response-field': false;
      callback: (token: string) => void;
      'error-callback': () => boolean;
      'expired-callback': () => void;
      'timeout-callback': () => void;
    },
  ) => string;
  reset: (widgetId: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const crmIntakeApproved = import.meta.env.VITE_CRM_INTAKE_APPROVED === 'true';
const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';
let turnstileApi: TurnstileApi | undefined;
let turnstileWidgetId: string | undefined;
let turnstileToken = '';
const submissionAttempts = new Map<string, { key: string; accepted: boolean }>();
const receivedMessage = 'Réception confirmée pour cette demande. Elle attend son examen par le studio; aucun rendez-vous ni suivi automatique n’est confirmé.';
let submissionAccepted = false;
let submissionInFlight = false;
let preserveTurnstileStatus = false;

function setContactStatus(message: string, state: 'idle' | 'loading' | 'success' | 'error' = 'idle'): void {
  if (!projectStatus) return;
  if (submissionAccepted && state !== 'success') return;
  projectStatus.textContent = message;
  projectStatus.dataset.state = state;
}

function updateCrmSubmitAvailability(): void {
  if (!crmSubmit) return;
  crmSubmit.disabled = !turnstileToken || submissionInFlight || submissionAccepted;
}

function setIntakeControlsDisabled(disabled: boolean): void {
  projectOptions.forEach((option) => {
    option.disabled = disabled;
  });
  [
    contactContext,
    contactOrganization,
    contactName,
    contactReply,
    contactWebsite,
    contactPrivacy,
  ].forEach((control) => {
    if (control) control.disabled = disabled;
  });
}

function clearIntakeInvalidState(): void {
  [contactOrganization, contactName, contactReply, contactContext, contactPrivacy].forEach((input) => {
    input?.removeAttribute('aria-invalid');
  });
}

function publicIntakeDraft(): PublicIntakeDraft {
  const checkedProject = projectOptions.find((option) => option.checked)?.value ?? selectedProject;
  return {
    organizationName: contactOrganization?.value ?? '',
    contactName: contactName?.value ?? '',
    contactEmail: contactReply?.value ?? '',
    projectType: isProjectKind(checkedProject) ? checkedProject : selectedProject,
    message: contactContext?.value ?? '',
    privacyAcknowledged: contactPrivacy?.checked ?? false,
    turnstileToken,
    website: contactWebsite?.value ?? '',
  };
}

function resetTurnstileToken(
  message: string,
  resetWidget = true,
  preserveMessageAfterRenewal = true,
): void {
  if (submissionAccepted || submissionInFlight) return;
  turnstileToken = '';
  preserveTurnstileStatus = preserveMessageAfterRenewal;
  updateCrmSubmitAvailability();
  if (resetWidget && turnstileApi && turnstileWidgetId) turnstileApi.reset(turnstileWidgetId);
  setContactStatus(message, 'error');
}

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.defer = true;
    script.dataset.turnstileScript = 'true';
    const finish = (api?: TurnstileApi): void => {
      window.clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      if (api) resolve(api);
      else {
        script.remove();
        reject(new Error('Turnstile script unavailable'));
      }
    };
    const timeout = window.setTimeout(() => finish(), 12_000);
    script.onload = () => finish(window.turnstile);
    script.onerror = () => finish();
    document.head.append(script);
  });
}

async function enableCrmIntake(): Promise<void> {
  if (document.documentElement.dataset.crmIntake === 'loading') return;
  if (
    !crmIntakeApproved
    || !turnstileSiteKey
    || !crmIntake
    || !crmUnavailable
    || !crmSubmit
    || !turnstileContainer
  ) {
    document.documentElement.dataset.crmIntake = 'disabled';
    if (crmUnavailable) crmUnavailable.textContent = 'L’envoi direct n’est pas disponible ici. Vous pouvez préparer un courriel.';
    return;
  }

  try {
    document.documentElement.dataset.crmIntake = 'loading';
    if (crmRetry) crmRetry.hidden = true;
    crmUnavailable.textContent = 'Chargement de la vérification sécurisée… Le courriel préparé reste disponible.';
    turnstileApi = await loadTurnstile();
    crmIntake.hidden = false;
    crmUnavailable.hidden = true;
    crmSubmit.type = 'submit';
    document.documentElement.dataset.crmIntake = 'enabled';
    turnstileWidgetId = turnstileApi.render(turnstileContainer, {
      sitekey: turnstileSiteKey,
      action: TURNSTILE_ACTION,
      theme: 'light',
      size: 'flexible',
      language: 'fr',
      'response-field': false,
      callback: (token) => {
        turnstileToken = token;
        updateCrmSubmitAvailability();
        if (!submissionAccepted && !submissionInFlight && !preserveTurnstileStatus) {
          setContactStatus('Vérification antirobot complétée. Le formulaire peut être envoyé.');
        }
      },
      'error-callback': () => {
        resetTurnstileToken(
          'La vérification antirobot est indisponible. Utilisez le courriel préparé.',
          false,
        );
        return true;
      },
      'expired-callback': () =>
        resetTurnstileToken('La vérification a expiré. Complétez-la de nouveau.', true, false),
      'timeout-callback': () =>
        resetTurnstileToken('La vérification a expiré. Complétez-la de nouveau.', true, false),
    });
  } catch {
    crmIntake.hidden = true;
    crmUnavailable.hidden = false;
    document.documentElement.dataset.crmIntake = 'disabled';
    crmUnavailable.textContent = 'La vérification est momentanément indisponible. Réessayez son chargement ou préparez un courriel.';
    if (crmRetry) crmRetry.hidden = false;
    setContactStatus('La vérification sécurisée ne peut pas être chargée. Utilisez le courriel préparé.', 'error');
  }
}

crmRetry?.addEventListener('click', () => { void enableCrmIntake(); });

contactForm?.addEventListener('input', (event) => {
  if (event.target instanceof HTMLElement) event.target.removeAttribute('aria-invalid');
  if (submissionInFlight) return;
  const wasAccepted = submissionAccepted;
  submissionAccepted = submissionAttempts.get(intakeDraftIdentity(publicIntakeDraft()))?.accepted ?? false;
  if (submissionAccepted) {
    setContactStatus(receivedMessage, 'success');
  } else if (wasAccepted) {
    resetTurnstileToken(
      'Le formulaire a changé. Complétez de nouveau la vérification antirobot.',
      true,
      false,
    );
  }
  updateCrmSubmitAvailability();
});

contactForm?.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (
    !crmIntakeApproved
    || !turnstileSiteKey
    || document.documentElement.dataset.crmIntake !== 'enabled'
  ) {
    mailLink?.click();
    return;
  }
  if (submissionInFlight || submissionAccepted) return;

  clearIntakeInvalidState();
  const draft = publicIntakeDraft();
  const errors = validatePublicIntakeDraft(draft);
  const firstError = Object.keys(errors)[0] as keyof PublicIntakeDraft | undefined;
  if (firstError) {
    const fields: Partial<Record<keyof PublicIntakeDraft, HTMLElement | null>> = {
      organizationName: contactOrganization,
      contactName,
      contactEmail: contactReply,
      message: contactContext,
      privacyAcknowledged: contactPrivacy,
      turnstileToken: turnstileContainer,
      website: contactWebsite,
    };
    const field = fields[firstError];
    field?.setAttribute('aria-invalid', 'true');
    field?.focus();
    setContactStatus(errors[firstError] ?? 'Vérifiez les renseignements fournis.', 'error');
    return;
  }

  const identity = intakeDraftIdentity(draft);
  const attempt = submissionAttempts.get(identity) ?? { key: createIdempotencyKey(), accepted: false };
  submissionAttempts.set(identity, attempt);
  submissionInFlight = true;
  setIntakeControlsDisabled(true);
  if (contactForm) contactForm.setAttribute('aria-busy', 'true');
  if (crmSubmitLabel) crmSubmitLabel.textContent = 'Envoi en cours…';
  setContactStatus('Envoi sécurisé en cours…', 'loading');
  updateCrmSubmitAvailability();

  let result: Awaited<ReturnType<typeof submitPublicIntake>>;
  try {
    result = await submitPublicIntake(createPublicIntakePayload(draft), attempt.key);
  } finally {
    submissionInFlight = false;
    setIntakeControlsDisabled(false);
    contactForm?.removeAttribute('aria-busy');
    if (crmSubmitLabel) crmSubmitLabel.textContent = 'Envoyer pour examen';
    updateCrmSubmitAvailability();
  }

  if (result.accepted) {
    attempt.accepted = true;
    submissionAccepted = true;
    turnstileToken = '';
    updateCrmSubmitAvailability();
    setContactStatus(receivedMessage, 'success');
    return;
  }

  resetTurnstileToken(
    result.status === 429
      ? 'Trop de tentatives ont été reçues. Réessayez plus tard ou utilisez le courriel préparé.'
      : 'Réception non confirmée. Votre demande a peut-être été reçue. Réessayez ce même brouillon; si vous passez au courriel, signalez cette première tentative.',
  );
});

function scheduleCrmIntake(): void {
  if (
    !crmIntakeApproved
    || !turnstileSiteKey
    || !contactForm
    || !('IntersectionObserver' in window)
  ) {
    void enableCrmIntake();
    return;
  }

  let started = false;
  const start = (): void => {
    if (started) return;
    started = true;
    observer.disconnect();
    contactForm.removeEventListener('focusin', start);
    window.removeEventListener('hashchange', startForContactHash);
    void enableCrmIntake();
  };
  const startForContactHash = (): void => {
    if (window.location.hash === '#contact') start();
  };
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries.some((entry) => entry.isIntersecting)) start();
    },
    { rootMargin: '600px 0px' },
  );
  observer.observe(contactForm);
  contactForm.addEventListener('focusin', start);
  window.addEventListener('hashchange', startForContactHash);
  startForContactHash();
}

scheduleCrmIntake();

const briefProposal = document.querySelector<HTMLElement>('[data-brief-proposal]');
const briefProposalText = document.querySelector<HTMLElement>('[data-brief-proposal-text]');
let pendingBrief: BriefSuggestion | undefined;

function applyBrief(suggestion: BriefSuggestion): void {
  if (!contactContext || submissionInFlight) return;
  contactContext.value = appendBrief(contactContext.value, suggestion.text);
  // Existing writing keeps its project category; only an empty draft takes the suggestion's category.
  contactContext.dispatchEvent(new Event('input', { bubbles: true }));
  contactContext.focus({ preventScroll: true });
  if (briefProposal) briefProposal.hidden = true;
  pendingBrief = undefined;
  setContactStatus('Brouillon préparé. Relisez-le et modifiez-le avant de décider de l’envoyer.');
}

function offerBrief(suggestion: BriefSuggestion): void {
  if (!contactContext || submissionInFlight) return;
  if (!contactContext.value.trim()) {
    selectProject(suggestion.project);
    applyBrief(suggestion);
  } else if (!contactContext.value.includes(suggestion.text.trim())) {
    pendingBrief = suggestion;
    if (briefProposalText) briefProposalText.textContent = suggestion.text;
    if (briefProposal) briefProposal.hidden = false;
    document.querySelector<HTMLButtonElement>('[data-brief-append]')?.focus({ preventScroll: true });
  } else {
    contactContext.focus({ preventScroll: true });
  }
}

document.querySelector('[data-scenario-contact]')?.addEventListener('click', (event) => {
  if (event instanceof MouseEvent && (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey)) return;
  const suggestion = scenarioBrief(checkedScenarioValue('scenario-need') ?? '', checkedScenarioValue('scenario-interface') ?? '', checkedScenarioValue('scenario-intelligence') ?? '');
  if (!suggestion || !contactContext || submissionInFlight) return;
  // Native fragment navigation would move focus away from the prepared field or
  // proposal button. Keep the anchor fallback, but own this enhanced transition.
  event.preventDefault();
  if (window.location.hash !== '#contact') window.history.pushState(null, '', '#contact');
  offerBrief(suggestion);
  if (document.activeElement instanceof HTMLElement) document.activeElement.scrollIntoView({ block: 'center' });
});
document.querySelector('[data-brief-append]')?.addEventListener('click', () => {
  if (pendingBrief) applyBrief(pendingBrief);
});
document.querySelector('[data-brief-dismiss]')?.addEventListener('click', () => {
  pendingBrief = undefined;
  if (briefProposal) briefProposal.hidden = true;
  contactContext?.focus({ preventScroll: true });
});
document.querySelector('[data-copy-brief]')?.addEventListener('click', async () => {
  const status = document.querySelector<HTMLElement>('[data-copy-brief-status]');
  const copied = await copyEmailAddress(contactContext?.value ?? '', navigator.clipboard?.writeText.bind(navigator.clipboard));
  if (status) status.textContent = copied ? 'Brouillon copié.' : 'Copie indisponible. Sélectionnez le texte du brouillon pour le copier.';
  if (!copied) { contactContext?.focus(); contactContext?.select(); }
});

// Only a fixed source identifier crosses pages. Free text and answers never enter the URL.
const contactUrl = new URL(window.location.href);
const source = contactUrl.searchParams.get('demande');
if (source !== null) {
  contactUrl.searchParams.delete('demande');
  window.history.replaceState(window.history.state, '', `${contactUrl.pathname}${contactUrl.search}${contactUrl.hash}`);
  const suggestion = sourceBrief(source);
  if (suggestion) offerBrief(suggestion);
}

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
