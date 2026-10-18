import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
    environmentMatchGlobs: [['tests/ui/**', 'jsdom']],
    env: { TZ: 'Europe/Paris' },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.js', 'server/**/*.js'],
      // Interface included: no file is excluded from coverage.
      thresholds: {
        perFile: true,
        lines: 80,
        statements: 80,
        functions: 80,
        branches: 80,
        'src/engine/**': { lines: 95, statements: 95, functions: 95, branches: 90 },
      },
    },
  },
});
