// Vercel previews and production validate the actual profile selected by Vite.
await import(process.env.VERCEL_ENV === 'preview'
  ? './check-preview-build.mjs'
  : './check-seo-build.mjs');
