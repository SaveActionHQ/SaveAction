import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/coverage/**',
      '**/*.js',
      '**/*.mjs',
    ],
  },
  {
    files: ['packages/**/*.ts'],
    rules: {
      // TypeScript specific
      '@typescript-eslint/no-unused-vars': ['error', { 
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      '@typescript-eslint/no-explicit-any': 'off', // Too many existing uses
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off', // Used intentionally in many places
      '@typescript-eslint/ban-ts-comment': 'off', // Allow @ts-ignore for special cases
      
      // General
      'no-console': 'off', // We use console for CLI output
      'prefer-const': 'error',
      'no-var': 'error',
      'no-case-declarations': 'off', // Allow let/const in case blocks
    },
  },
  {
    // Test files have relaxed rules
    files: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  }
);
