// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://read.significanthobbies.com',
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: 'file',
    inlineStylesheets: 'always',
  },
  integrations: [sitemap()],
  vite: {
    css: { transformer: 'lightningcss' },
    build: { cssMinify: 'lightningcss' },
  },
});
