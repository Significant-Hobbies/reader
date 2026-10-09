import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

import { isSpaRoute } from './src/lib/spa-route';

function appRoutes(): Plugin {
  const rewrite: import('vite').Connect.NextHandleFunction = (request, _response, next) => {
    const pathname = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (isSpaRoute(pathname)) request.url = '/app.html';
    next();
  };
  return {
    name: 'app-routes',
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig(() => ({
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), tailwindcss(), appRoutes()],
  css: {
    transformer: 'lightningcss',
    lightningcss: {
      drafts: { customMedia: true },
    },
  },
  build: {
    modulePreload: false,
    outDir: 'dist',
    emptyOutDir: true,
    cssMinify: 'lightningcss',
    rollupOptions: {
      input: {
        app: path.resolve(__dirname, 'app.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
}));
