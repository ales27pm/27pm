import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/newsreader';
import './styles.css';
import { buildProjectMailto, isProjectKind, type ProjectKind } from './contact';

document.documentElement.classList.add('js');

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

function setMenu(open: boolean): void {
  syncNavigationState(open);
}

menuButton?.addEventListener('click', () => {
  setMenu(!menuIsOpen());
});

navigation?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => setMenu(false));
});

document.addEventListener('keydown', (event) => {
  if (!mobileMenu.matches || !menuIsOpen() || !menuButton || !navigation) return;

  if (event.key === 'Escape') {
    event.preventDefault();
    setMenu(false);
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

const projectOptions = [...document.querySelectorAll<HTMLInputElement>('input[name="project"]')];
const mailLink = document.querySelector<HTMLAnchorElement>('[data-project-mail]');
const status = document.querySelector<HTMLElement>('[data-project-status]');

function selectProject(project: ProjectKind, announce = false): void {
  const option = projectOptions.find((item) => item.value === project);
  if (!option || !mailLink) return;

  option.checked = true;
  mailLink.href = buildProjectMailto(project);

  document.querySelectorAll<HTMLElement>('[data-project-option]').forEach((label) => {
    label.classList.toggle('is-selected', label.dataset.projectOption === project);
  });

  if (announce && status) {
    status.textContent = `Choix sélectionné : ${option.dataset.label ?? option.value}.`;
  }
}

projectOptions.forEach((option) => {
  option.addEventListener('change', () => {
    if (isProjectKind(option.value)) selectProject(option.value, true);
  });
});

document.querySelectorAll<HTMLElement>('[data-select-project]').forEach((trigger) => {
  trigger.addEventListener('click', () => {
    const project = trigger.dataset.selectProject;
    if (project && isProjectKind(project)) selectProject(project);
  });
});

selectProject('site');

const sectionLinks = [...document.querySelectorAll<HTMLAnchorElement>('.site-nav > a[href^="#"]:not(.button)')];
const observedSections = sectionLinks
  .map((link) => {
    const id = link.hash.slice(1);
    const section = document.getElementById(id);
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

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems = [...document.querySelectorAll<HTMLElement>('[data-reveal]')];

if (prefersReducedMotion || !('IntersectionObserver' in window)) {
  revealItems.forEach((item) => item.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    },
    { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
  );

  revealItems.forEach((item) => observer.observe(item));
}

document.querySelectorAll<HTMLElement>('[data-year]').forEach((item) => {
  item.textContent = String(new Date().getFullYear());
});
