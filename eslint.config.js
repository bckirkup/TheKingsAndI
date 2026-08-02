import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the injected seeded PRNG instead of Math.random.',
        },
      ],
    },
  },
  {
    files: ['src/core/random.ts'],
    rules: {
      'no-restricted-properties': 'off',
    },
  },
  {
    name: 'app-layer-boundary',
    files: ['src/app/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/orchestration/**',
                '**/psychology/**',
                '**/chess/**',
                '**/engine/**',
              ],
              message:
                'App may only import UI and lower-level presentation code.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'ui-layer-boundary',
    files: ['src/ui/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '**/orchestration/**',
                '**/psychology/**',
                '**/chess/**',
                '**/engine/**',
              ],
              message: 'UI may only import presentation code.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'orchestration-layer-boundary',
    files: ['src/orchestration/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/psychology/**', '**/chess/**', '**/engine/**'],
              message: 'Orchestration may not import above its layer.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'psychology-layer-boundary',
    files: ['src/psychology/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/ui/**', '**/engine/**'],
              message:
                'Psychology must remain pure and independent of UI and engine.',
            },
          ],
        },
      ],
    },
  },
  prettier,
);
