import { defineConfig, build as viteBuild } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { cpSync, existsSync, mkdirSync } from 'fs';

const __dirname = import.meta.dirname;

const buildExtensionAssets = (): import('vite').Plugin => ({
  name: 'build-extension-assets',
  async closeBundle() {
    // Build content script as IIFE (content scripts can't use ES modules)
    await viteBuild({
      configFile: false,
      build: {
        emptyOutDir: false,
        outDir: resolve(__dirname, 'dist'),
        lib: {
          entry: resolve(__dirname, 'src/content-script.ts'),
          formats: ['iife'],
          name: 'ContentScript',
          fileName: () => 'content-script',
        },
        rollupOptions: {
          output: {
            extend: true,
            entryFileNames: 'content-script.js',
          },
        },
        minify: true,
      },
      logLevel: 'warn',
    });

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
        'side-panel/index': resolve(__dirname, 'side-panel/index.html'),
        background: resolve(__dirname, 'src/background.ts'),
      },
      output: {
        entryFileNames: (chunk) => {
          if (chunk.name === 'background') return 'background.js';
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
