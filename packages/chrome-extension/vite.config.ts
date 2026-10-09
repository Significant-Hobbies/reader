import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { cpSync, existsSync, mkdirSync } from 'fs';

const __dirname = import.meta.dirname;

const buildExtensionAssets = (): import('vite').Plugin => ({
  name: 'build-extension-assets',
  async closeBundle() {
    // Copy manifest.json
    cpSync(resolve(__dirname, 'manifest.json'), resolve(__dirname, 'dist/manifest.json'));

    // Copy icons
    const iconsDir = resolve(__dirname, 'icons');
    const distIcons = resolve(__dirname, 'dist/icons');
    if (existsSync(iconsDir)) {
      if (!existsSync(distIcons)) mkdirSync(distIcons, { recursive: true });
      cpSync(iconsDir, distIcons, { recursive: true });
    }
  },
});

export default defineConfig({
  plugins: [react(), buildExtensionAssets()],
  base: './',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        'popup/index': resolve(__dirname, 'popup/index.html'),
      },
      output: {
        entryFileNames: (chunk) => {
          return '[name]-[hash].js';
        },
        chunkFileNames: 'assets/chunks/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  css: {
    postcss: resolve(__dirname, 'postcss.config.mjs'),
  },
});
