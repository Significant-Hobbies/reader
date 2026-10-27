import content from '../landing-astro/src/content/reader.json' with { type: 'json' };
import copy from './public-copy.json' with { type: 'json' };
import { createAgentSurfaceManifest } from './agent-surfaces/manifest.mjs';
import { createAgentSurfaceHandler } from './agent-surfaces/handler.mjs';
import { listMarkdownRoutes } from './agent-surfaces/documents.mjs';
import { absoluteMarkdownLinks } from './agent-surfaces/format.mjs';

export const SITE_ORIGIN = content.url;
export const publicIdentityGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_ORIGIN}/#publisher`,
      name: 'Significant Hobbies',
      url: 'https://significanthobbies.com/',
      description:
        'A family of maintained personal applications built around focused, private workflows.',
      logo: `${SITE_ORIGIN}/icon.svg`,
      founder: {
        '@type': 'Person',
        name: 'Sarthak Agrawal',
        url: 'https://sarthakagrawal.dev/',
      },
      sameAs: [
        'https://github.com/Significant-Hobbies',
        'https://github.com/Significant-Hobbies/reader',
      ],
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_ORIGIN}/#website`,
      name: 'Reader',
      url: SITE_ORIGIN,
      description: content.page.description,
      inLanguage: 'en',
      publisher: { '@id': `${SITE_ORIGIN}/#publisher` },
    },
  ],
};

export const excludedPaths = [
  '/api',
  '/admin',
  '/auth',
  '/dashboard',
  '/library',
  '/login',
  '/extension',
  '/app',
];
const absolute = (path) => new URL(path, SITE_ORIGIN).href;
const action = (link) => `[${link.label}](${absolute(link.href)})`;
function page(path, title, description, lines) {
  return absoluteMarkdownLinks(
    [
      `# ${title}`,
      '',
      `> ${description}`,
      '',
      `Canonical: ${absolute(path)}`,
      '',
      ...lines,
      '',
      '## Related',
      '',
      '[Reader](/) · [Questions](/faq) · [Changes](/changelog) · [Privacy](/privacy)',
      '',
    ].join('\n'),
    absolute(path)
  );
}

// Explicitly map the authored Workbench content; never read an account or scrape HTML.
const hero = content.hero;
const home = [
  hero.eyebrow,
  '',
  `## ${hero.title}`,
  '',
  hero.lede,
  '',
  action(hero.primary),
  '',
  action(hero.secondary),
  '',
  hero.note,
  '',
  `![${hero.window.alt}](${absolute(hero.window.src)})`,
  '',
  hero.caption,
  '',
];
for (const section of content.sections) {
  for (const block of section.blocks) {
    home.push(`## ${block.title}`, '', block.eyebrow ?? '', '', block.lede ?? '', '');
    if (block.type === 'statement') {
      for (const point of block.points) home.push(`### ${point.title}`, '', point.body, '');
    } else if (block.type === 'faq') {
      for (const item of block.items) home.push(`### ${item.q}`, '', item.a, '');
    } else if (block.type === 'cta') {
      if (block.primary) home.push(action(block.primary), '');
      if (block.secondary) home.push(action(block.secondary), '');
    } else throw new Error(`Unmapped Reader public block: ${block.type}`);
  }
}
export const publicPages = {
  '/': page('/', content.page.title, content.page.description, home),
  '/faq': page('/faq', copy.faq.title, copy.faq.description, [
    `## ${copy.faq.heading}`,
    '',
    ...copy.faq.questions.flatMap((item) => [`### ${item.question}`, '', item.answer, '']),
  ]),
  '/changelog': page('/changelog', copy.changelog.title, copy.changelog.description, [
    'Product direction',
    '',
    `## ${copy.changelog.heading}`,
    '',
    ...copy.changelog.paragraphs.flatMap((paragraph) => [paragraph, '']),
    '[Source history](https://github.com/Significant-Hobbies/reader/commits/main)',
  ]),
  '/privacy': page(
    '/privacy',
    copy.privacy.title,
    copy.privacy.description,
    copy.privacy.paragraphs.flatMap((paragraph) => [paragraph, ''])
  ),
};
export const publicManifest = createAgentSurfaceManifest({
  name: content.product,
  url: SITE_ORIGIN,
  summary: content.page.description,
  contact: 'https://github.com/Significant-Hobbies/reader/issues',
  updatedAt: '2026-10-26',
  trainingAllowed: true,
  excludedPaths,
  sitemap: absolute('/sitemap.xml'),
  openapi: absolute('/openapi.json'),
  notes: [
    'Personal libraries, account records, API keys, and MCP responses are private.',
    `Existing public guides: [Agent instructions](${absolute('/agents.md')}) and [Access and pricing](${absolute('/pricing.md')}).`,
  ],
  pages: publicPages,
});
export const publicRoutes = listMarkdownRoutes(publicManifest);
export const handlePublicDocument = createAgentSurfaceHandler({
  manifest: publicManifest,
  preserveMarkdownPaths: ['/pricing.md'],
});
export const publicRobots = [
  '# Keep in sync with /llms.txt and /ai.txt.',
  '',
  ...[
    '*',
    'OAI-SearchBot',
    'ChatGPT-User',
    'Claude-SearchBot',
    'Claude-User',
    'PerplexityBot',
    'Perplexity-User',
    'GPTBot',
    'ClaudeBot',
    'Google-Extended',
    'Applebot-Extended',
    'CCBot',
    'Bytespider',
  ].flatMap((bot) => [
    `User-agent: ${bot}`,
    'Allow: /',
    ...excludedPaths.flatMap((path) => [`Disallow: ${path}$`, `Disallow: ${path}/`]),
    'Allow: /api/ai$',
    'Allow: /api/md/',
    'Allow: /llms.txt',
    'Allow: /llms-full.txt',
    'Allow: /index.md',
    '',
  ]),
  `Sitemap: ${absolute('/sitemap.xml')}`,
  '',
].join('\n');
export const publicSitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${publicRoutes.map((route) => `<url><loc>${route.url}</loc></url>`).join('')}</urlset>\n`;
