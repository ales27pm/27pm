import '@fontsource-variable/instrument-sans';
import '@fontsource-variable/newsreader';
import './styles.css';

document.documentElement.classList.add('js');

document.querySelectorAll<HTMLElement>('[data-year]').forEach((item) => {
  item.textContent = String(new Date().getFullYear());
});
