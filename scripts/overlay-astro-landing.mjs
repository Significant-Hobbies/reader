#!/usr/bin/env node
// Copies the Astro landing build over dist/index.html so GET / serves the
// static marketing page while the Vite SPA lives at dist/app.html.

import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const ASTRO_DIST = resolve('landing-astro/dist');
const TARGET = resolve('dist');

const PROTECTED_PREFIXES = ['assets/', 'app.html'];

// The shared template only accepts a single image URL. Add delivery attributes
// to its static output without forking the template or changing its layout.
function optimizeLandingImages(source) {
  let html = source;
  const images = [
    {
      src: '/images/inbox.png',
      base: '/images/inbox',
      widths: [480, 960, 1600],
      width: 1600,
      height: 900,
      sizes: '(min-width: 1024px) 896px, calc(100vw - 80px)',
    },
    {
      src: '/footer-art/reader-precise-original-v1.webp',
      base: '/footer-art/reader-precise',
      widths: [480, 768, 1536, 2172],
      width: 2172,
      height: 724,
      sizes: '(min-width: 1200px) 1152px, calc(100vw - 44px)',
    },
  ];
  for (const image of images) {
    html = html.replace(/<link\b[^>]*>/g, (tag) =>
      tag.includes('rel="preload"') && tag.includes(`href="${image.src}"`) ? '' : tag
    );
    html = html.replace(/<img\b[^>]*>/g, (tag) => {
      if (!tag.includes(`src="${image.src}"`)) return tag;
      const attributes = tag.replace(
        /\s(?:src|srcset|sizes|width|height|loading|fetchpriority)="[^"]*"/gi,
        ''
      );
      const srcset = image.widths
        .map((width) => `${image.base}-${width}.webp ${width}w`)
        .join(', ');
      return attributes.replace(
        '<img',
        `<img src="${image.base}-${image.width}.webp" srcset="${srcset}" sizes="${image.sizes}" width="${image.width}" height="${image.height}" loading="lazy"`
      );
    });
  }
  return html;
}

async function walk(dir, rel = '') {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    const fullSrc = join(dir, e.name);
    const fullRel = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      out.push(...(await walk(fullSrc, fullRel)));
    } else {
      out.push({ src: fullSrc, rel: fullRel });
    }
  }
  return out;
}

async function mergeHeaders(astroHeadersPath, targetHeadersPath) {
  const astroHeaders = existsSync(astroHeadersPath) ? await readFile(astroHeadersPath, 'utf8') : '';
  const targetHeaders = existsSync(targetHeadersPath)
    ? await readFile(targetHeadersPath, 'utf8')
    : '';
  if (!astroHeaders) return false;
  const merged = `# --- from landing-astro/dist/_headers ---\n${astroHeaders.trim()}\n\n# --- from Vite build ---\n${targetHeaders.trim()}\n`;
  await writeFile(targetHeadersPath, merged);
  return true;
}

async function main() {
  if (!existsSync(ASTRO_DIST)) {
    console.warn('[overlay-astro] no landing-astro/dist — skipping');
    return;
  }
  if (!existsSync(TARGET)) {
    console.error('[overlay-astro] no dist/ — run vite build first');
    process.exit(1);
  }

  const files = await walk(ASTRO_DIST);
  let copied = 0;
  let skipped = 0;

  for (const { src, rel } of files) {
    if (PROTECTED_PREFIXES.some((p) => rel.startsWith(p))) {
      skipped += 1;
      continue;
    }
    if (rel === '_headers') {
      await mergeHeaders(src, join(TARGET, '_headers'));
      continue;
    }
    const dest = join(TARGET, rel);
    await mkdir(dirname(dest), { recursive: true });
    if (rel === 'index.html') {
      await writeFile(dest, optimizeLandingImages(await readFile(src, 'utf8')));
    } else {
      await copyFile(src, dest);
    }
    copied += 1;
  }

  console.log(
    `[overlay-astro] copied ${copied} file(s) from landing-astro/dist → dist/, skipped ${skipped} protected path(s)`
  );
}

main().catch((err) => {
  console.error('[overlay-astro] fatal:', err);
  process.exit(1);
});
