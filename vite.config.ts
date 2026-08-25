import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const pagesPreviewPlugin = (): Plugin => ({
  name: '27pm-pages-preview',
  transformIndexHtml(html) {
    return html.replaceAll('content="index, follow"', 'content="noindex, nofollow"');
  },
});

const normalizeBasePath = (basePath: string) => {
  const path = basePath.replace(/^\/+|\/+$/g, '');
  return path ? `/${path}/` : '/';
};

export default defineConfig(({ mode }) => {
  const isPagesBuild = mode === 'github-pages';
  const pagesBasePath = normalizeBasePath(process.env.PAGES_BASE_PATH ?? '/27pm');
  const isPagesPreview = isPagesBuild && (process.env.PAGES_HOST ?? 'ales27pm.github.io') !== '27pm.org';

  return {
    base: isPagesBuild ? pagesBasePath : '/',
    plugins: isPagesPreview ? [pagesPreviewPlugin()] : [],
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
