import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  publicRoutes,
  publicPages,
  publicManifest,
  publicRobots,
  publicSitemap,
} from '../src/public-site.mjs';
import {
  buildAiTxt,
  buildFullMarkdown,
  buildMarkdownIndex,
} from '../src/agent-surfaces/documents.mjs';

const output = resolve(import.meta.dirname, '../public');
for (const route of publicRoutes) {
  await writeFile(resolve(output, new URL(route.md).pathname.slice(1)), publicPages[route.path]);
}
await writeFile(resolve(output, 'llms.txt'), buildMarkdownIndex(publicManifest, publicRoutes));
await writeFile(
  resolve(output, 'llms-full.txt'),
  (await buildFullMarkdown(publicManifest, publicRoutes, (path) => publicPages[path])).replace(
    /^Generated: \d{4}-\d{2}-\d{2}$/m,
    `Source updated: ${publicManifest.updatedAt}`
  )
);
await writeFile(resolve(output, 'ai.txt'), buildAiTxt(publicManifest, publicRoutes));
await writeFile(resolve(output, 'robots.txt'), publicRobots);
await writeFile(resolve(output, 'sitemap.xml'), publicSitemap);
const catalogPath = resolve(output, 'api-ai.json');
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
catalog.surfaces = publicRoutes.map((route) => ({
  id: route.path === '/' ? 'home' : route.path.slice(1),
  kind: 'static',
  url: route.url,
  md: route.md,
  description: route.description,
}));
await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(
  `Generated ${publicRoutes.length} public Reader Markdown pages and discovery documents.`
);
