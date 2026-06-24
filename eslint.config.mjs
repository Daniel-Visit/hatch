// Flat ESLint config. Apps (Next.js) may extend with their own config.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/.turbo/**',
      '**/coverage/**',
      'prototype/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      // Allow server-side diagnostic logging (console.warn/error) — matches the
      // existing cron routes (pick-featured/refresh-scores). console.log stays banned.
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  {
    // Eval runners legitimately print scores/results to stdout.
    files: ['**/eval/**'],
    rules: { 'no-console': 'off' },
  },
];
