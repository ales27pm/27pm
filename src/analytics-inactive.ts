const ANALYTICS_CONSENT_STORAGE_KEY = '27pm.analytics-consent.v1';

function clearInactiveAnalyticsState(): void {
  try {
    window.localStorage.removeItem(ANALYTICS_CONSENT_STORAGE_KEY);
  } catch {
    // Storage can be unavailable; no measurement code is present in this build.
  }

  try {
    const cookieNames = document.cookie
      .split(';')
      .map((cookie) => cookie.split('=', 1)[0]?.trim() ?? '')
      .filter((name) => /^_ga(?:_|$)/.test(name));
    const domains = new Set(['', window.location.hostname, '27pm.org', '.27pm.org']);

    for (const name of cookieNames) {
      for (const domain of domains) {
        const domainAttribute = domain ? `; Domain=${domain}` : '';
        document.cookie = `${name}=; Max-Age=0; Path=/${domainAttribute}; SameSite=Lax`;
      }
    }
  } catch {
    // A restrictive browser may reject cookie access; no tag can load in this build.
  }
}

export function initializeInactiveAnalyticsControls(): void {
  clearInactiveAnalyticsState();

  const dialog = document.querySelector<HTMLElement>('[data-analytics-consent]');
  const dialogTitle = dialog?.querySelector<HTMLElement>('[data-analytics-consent-title]');
  const acceptButton = dialog?.querySelector<HTMLButtonElement>('[data-analytics-accept]');
  const closeButton = dialog?.querySelector<HTMLButtonElement>('[data-analytics-deny]');
  const status = dialog?.querySelector<HTMLElement>('[data-analytics-status]');
  const preferenceButtons = [
    ...document.querySelectorAll<HTMLButtonElement>('[data-analytics-preferences]'),
  ];
  let returnFocus: HTMLButtonElement | null = null;

  if (dialog) dialog.hidden = true;
  if (acceptButton) acceptButton.hidden = true;
  if (closeButton) closeButton.textContent = 'Fermer';
  if (status) {
    status.textContent = 'La mesure d’audience n’est pas activée sur cette version du site.';
  }

  const closeDialog = () => {
    if (dialog) dialog.hidden = true;
    returnFocus?.focus({ preventScroll: true });
    returnFocus = null;
  };

  preferenceButtons.forEach((button) => {
    button.hidden = false;
    button.addEventListener('click', () => {
      returnFocus = button;
      if (dialog) dialog.hidden = false;
      dialogTitle?.focus({ preventScroll: true });
    });
  });

  closeButton?.addEventListener('click', closeDialog);
  dialog?.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !returnFocus) return;
    event.preventDefault();
    closeDialog();
  });
}
