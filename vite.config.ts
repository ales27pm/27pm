import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const pagesPreviewPlugin = (): Plugin => ({
  name: '27pm-pages-preview',
  transformIndexHtml(html) {
    return html.replaceAll('content="index, follow"', 'content="noindex, nofollow"');
  },
});

const pagesDomainPlugin = (): Plugin => ({
  name: '27pm-pages-domain',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'CNAME', source: '27pm.org\n' });
    this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
  },
});

const normalizeBasePath = (basePath: string) => {
  const path = basePath.replace(/^\/+|\/+$/g, '');
  return path ? `/${path}/` : '/';
};

const productionPagesConfig = () => {
  const base = normalizeBasePath(process.env.PAGES_BASE_PATH ?? '/');
  if (base !== '/') {
    throw new Error('GitHub Pages production builds for 27pm.org must use PAGES_BASE_PATH=/');
  }

  return { base, plugins: [pagesDomainPlugin()] };
};

const previewPagesConfig = () => ({
  base: normalizeBasePath(process.env.PAGES_BASE_PATH ?? '/27pm'),
  plugins: [pagesPreviewPlugin()],
});

const resolvePagesConfig = (mode: string) => {
  if (mode !== 'github-pages') return { base: '/', plugins: [] };
  return (process.env.PAGES_HOST ?? '27pm.org') === '27pm.org'
    ? productionPagesConfig()
    : previewPagesConfig();
};

export default defineConfig(({ mode }) => {
  const pages = resolvePagesConfig(mode);

  return {
    base: pages.base,
    plugins: pages.plugins,
    build: {
      rollupOptions: {
        input: {
          main: resolve(process.cwd(), 'index.html'),
          confidentialite: resolve(process.cwd(), 'confidentialite/index.html'),
          notFound: resolve(process.cwd(), '404.html'),
        },
      },
    },
  };
});
