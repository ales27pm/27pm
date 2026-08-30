import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/newsreader';
import './styles.css';
import { initializeInactiveAnalyticsControls } from './analytics-inactive';

document.documentElement.classList.add('js');
if (import.meta.env.VITE_ANALYTICS_APPROVED === 'true') {
  void import('./analytics').then(({ initializeAnalyticsConsent }) => {
    initializeAnalyticsConsent({ enabled: true });
  });
} else {
  initializeInactiveAnalyticsControls();
}

document.querySelectorAll<HTMLElement>('[data-year]').forEach((item) => {
  item.textContent = String(new Date().getFullYear());
});
