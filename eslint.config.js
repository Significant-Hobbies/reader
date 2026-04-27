import config from '@saas-maker/eslint-config/next';

// Ignore generated bundle directories (huge worker.js files OOM ESLint).
export default [
  {
    ignores: [
      '.cf-pages-bundle',
      '.open-next',
      '.wrangler',
      '.next',
      'out',
      'dist',
      'build',
      'node_modules',
      'packages/**',
    ],
  },
  ...config,
];
