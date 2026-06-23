import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    include: ['src/**/__tests__/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      // Only the lib module with established test coverage is gated.
      // UI components (popup, side-panel) are excluded — no unit tests yet.
      include: ['src/side-panel/lib/importQuality.ts'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/**/__tests__/**',
      ],
      thresholds: {
        lines: 70,
        functions: 80,
      },
    },
  },
});
