// Optional mutation testing of the calculation engine: npm run test:mutation (a few minutes).
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.js', related: false },
  mutate: ['src/engine/**/*.js', '!src/engine/types.js'],
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  thresholds: { high: 85, low: 70, break: 60 },
  coverageAnalysis: 'perTest',
  tempDirName: '.stryker-tmp',
};
