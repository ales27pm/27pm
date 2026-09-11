import { rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import contentRoutes from './src/content-routes.json' with { type: 'json' };

const publicPaths = ['/', '/confidentialite/', ...contentRoutes];
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${publicPaths.map((path) => `  <url><loc>https://27pm.org${path}</loc></url>`).join('\n')}\n</urlset>\n`;

const sitemapPlugin = (): Plugin => ({
  name: '27pm-sitemap',
  configureServer(server) {
    server.middlewares.use('/sitemap.xml', (_request, response) => {
      response.setHeader('Content-Type', 'application/xml');
      response.end(sitemapXml);
    });
  },
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemapXml });
  },
});

const pagesPreviewPlugin = (): Plugin => ({
  name: '27pm-pages-preview',
  transformIndexHtml(html) {
    return html.replaceAll('content="index, follow"', 'content="noindex, nofollow"');
  },
  writeBundle(options) {
    const outDir = resolve(process.cwd(), options.dir ?? 'dist');
    rmSync(resolve(outDir, 'CNAME'), { force: true });
    writeFileSync(resolve(outDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
  },
});

const normalizeBasePath = (basePath: string) => {
  const path = basePath.replace(/^\/+|\/+$/g, '');
  return path ? `/${path}/` : '/';
};

const previewPagesConfig = () => ({
  base: normalizeBasePath(process.env.PAGES_BASE_PATH ?? '/27pm'),
  plugins: [pagesPreviewPlugin()],
});

const resolvePagesConfig = (mode: string) => {
  if (mode === 'preview' || process.env.VERCEL_ENV === 'preview') {
    return { base: '/', plugins: [pagesPreviewPlugin()] };
  }
  if (mode !== 'github-pages') return { base: '/', plugins: [] };
  return previewPagesConfig();
};

export default defineConfig(({ mode }) => {
  const pages = resolvePagesConfig(mode);
  const preview = mode === 'preview' || mode === 'github-pages' || process.env.VERCEL_ENV === 'preview';

  return {
    appType: 'mpa',
    server: { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    preview: { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    base: pages.base,
    plugins: [sitemapPlugin(), ...pages.plugins],
    define: preview ? {
      'import.meta.env.VITE_ANALYTICS_APPROVED': JSON.stringify('false'),
      'import.meta.env.VITE_CRM_INTAKE_APPROVED': JSON.stringify('false'),
      'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(''),
    } : {},
    build: {
      assetsDir: 'assets/generated',
      rollupOptions: {
        input: {
          main: resolve(process.cwd(), 'index.html'),
          confidentialite: resolve(process.cwd(), 'confidentialite/index.html'),
          notFound: resolve(process.cwd(), '404.html'),
          ...Object.fromEntries(contentRoutes.map((route) => [
            route.slice(1, -1).replaceAll('/', '-'),
            resolve(process.cwd(), `${route.slice(1)}index.html`),
          ])),
        },
      },
    },
  };
});
