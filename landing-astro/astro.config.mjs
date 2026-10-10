// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://read.significanthobbies.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
  },
  integrations: [sitemap(), react()],
  vite: {
    plugins: [tailwindcss()],
    css: { transformer: 'lightningcss' },
    build: { cssMinify: 'lightningcss' },
  },
});
