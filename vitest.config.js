import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    maxWorkers: 1,
    minWorkers: 1,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**/*.js'],
      exclude: ['src/main.js'], // DOM shell only; all business logic lives in domain modules
      thresholds: { statements: 90, lines: 90, functions: 90, branches: 85 },
    },
  },
});
