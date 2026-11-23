import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    // Code that runs inside the audited page (browser collector)
    files: ['skills/**/*.js', 'scripts/collector.template.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser } },
  },
  { ignores: ['node_modules/**', 'test/fixtures/**'] },
];
