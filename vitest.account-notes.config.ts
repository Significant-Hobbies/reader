import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['scripts/qualify-account-notes.test.ts', 'scripts/qualify-account-article.test.ts'],
    testTimeout: 90000,
  },
});
