import js from '@eslint/js';
import noUnsanitized from 'eslint-plugin-no-unsanitized';
import security from 'eslint-plugin-security';
import globals from 'globals';

export default [
  { ignores: ['dist', 'coverage', 'node_modules', 'reports', '.stryker-tmp', 'public'] },
  js.configs.recommended,
  security.configs.recommended,
  noUnsanitized.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      // Lookups on validated keys are the norm in this code base.
      'security/detect-object-injection': 'off',
      // Business code uses the injected clock (ctx.now), never the system clock.
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date'][arguments.length=0]",
          message: 'Use the injected clock instead of new Date().',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'Use the injected clock instead of Date.now().',
        },
      ],
    },
  },
  {
    // Entry points/adapters are the only places allowed to read the system clock.
    files: ['src/main.js', 'src/backend/local-backend.js', 'server/**/*.js', 'scripts/**/*.js'],
    rules: { 'no-restricted-syntax': 'off', 'no-restricted-properties': 'off' },
  },
  {
    // File paths there come from the operator's configuration, never from a request.
    files: ['server/**/*.js', 'scripts/**/*.js'],
    rules: { 'security/detect-non-literal-fs-filename': 'off' },
  },
  {
    files: ['tests/**/*.js'],
    rules: {
      'no-restricted-syntax': 'off',
      'no-restricted-properties': 'off',
      'security/detect-non-literal-fs-filename': 'off',
      'security/detect-non-literal-regexp': 'off',
    },
  },
];
