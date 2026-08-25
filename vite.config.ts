import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(process.cwd(), 'index.html'),
        confidentialite: resolve(process.cwd(), 'confidentialite/index.html'),
        notFound: resolve(process.cwd(), '404.html'),
      },
    },
  },
});
