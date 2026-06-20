import path from 'path';
import type { Plugin } from 'vite';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/** Load extracted app.css without blocking first paint — static shells carry critical CSS. */
function deferAppCss(): Plugin {
  return {
    name: 'defer-app-css',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        return html.replace(
          /<link rel="stylesheet" crossorigin href="(\/assets\/(?:app|bootstrap)-[^"]+\.css)">/,
          [
            '<link rel="preload" href="$1" as="style" onload="this.onload=null;this.rel=\'stylesheet\'">',
            '<noscript><link rel="stylesheet" href="$1"></noscript>',
          ].join('\n    ')
        );
      },
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
  plugins: [react(), tailwindcss(), deferAppCss()],
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
