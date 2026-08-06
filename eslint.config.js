import eslint from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

const higherLayers = {
  app: ['**/app/**'],
  ui: ['**/app/**'],
  orchestration: ['**/app/**', '**/ui/**'],
  psychology: ['**/app/**', '**/ui/**', '**/orchestration/**'],
  chess: ['**/app/**', '**/ui/**', '**/orchestration/**', '**/psychology/**'],
  engine: [
    '**/app/**',
    '**/ui/**',
    '**/orchestration/**',
    '**/psychology/**',
    '**/chess/**',
  ],
};

const boundaryRule = (patterns) => ({
  '@typescript-eslint/no-restricted-imports': [
    'error',
    {
      patterns: patterns.map((group) => ({
        group: [group],
        message: 'Layer imports must flow downward only.',
      })),
    },
  ],
});

const transcendentalProperties = [
  'exp',
  'pow',
  'log',
  'log2',
  'log10',
  'sin',
  'cos',
  'tan',
  'atan',
  'cbrt',
  'hypot',
];

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ['dist/**', 'coverage/**', 'node_modules/**', 'vendor/**'],
  },
  {
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
    rules: boundaryRule(['**/engine/**']),
  },
  {
    name: 'ui-layer-boundary',
    files: ['src/ui/**'],
    rules: boundaryRule([...higherLayers.ui, '**/engine/**']),
  },
  {
    name: 'orchestration-layer-boundary',
    files: ['src/orchestration/**'],
    rules: boundaryRule([...higherLayers.orchestration, '**/engine/**']),
  },
  {
    name: 'psychology-layer-boundary',
    files: ['src/psychology/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            ...higherLayers.psychology.map((group) => ({
              group: [group],
              message: 'Layer imports must flow downward only.',
            })),
            {
              group: ['**/chess/**'],
              allowTypeImports: true,
              message:
                'Psychology may only use core values; chess imports are type-only.',
            },
            {
              group: ['**/engine/**'],
              message:
                'Engine implementations are private to the engine layer.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'chess-layer-boundary',
    files: ['src/chess/**'],
    rules: boundaryRule([...higherLayers.chess, '**/engine/**']),
  },
  {
    name: 'engine-layer-boundary',
    files: ['src/engine/**'],
    rules: boundaryRule(higherLayers.engine),
  },
  {
    name: 'narrative-layer-boundary',
    files: ['src/narrative/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            ...[
              '**/app/**',
              '**/ui/**',
              '**/orchestration/**',
              '**/persistence/**',
              '**/sim/**',
              '**/chess/**',
              '**/engine/**',
            ].map((group) => ({
              group: [group],
              message: 'Layer imports must flow downward only.',
            })),
            {
              group: ['**/psychology/**'],
              allowTypeImports: true,
              message:
                'Narration renders projections; psychology imports are type-only.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'deterministic-math',
    files: ['src/psychology/**', 'src/chess/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the injected seeded PRNG instead of Math.random.',
        },
        ...transcendentalProperties.map((property) => ({
          object: 'Math',
          property,
          message:
            'Transcendentals are banned here; see ADR 0032 §4 for deterministic math.',
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "BinaryExpression[operator='**']",
          message:
            'Transcendentals are banned here; see ADR 0032 §4 for deterministic math.',
        },
      ],
    },
  },
  {
    name: 'query-barrier',
    files: ['src/engine/**', 'src/orchestration/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Use the injected seeded PRNG instead of Math.random.',
        },
        ...['race', 'any'].map((property) => ({
          object: 'Promise',
          property,
          message:
            'A ply may not proceed on the first result back; await the whole round (ADR 0034 §4).',
        })),
      ],
      'no-restricted-globals': [
        'error',
        ...['setTimeout', 'setInterval'].map((name) => ({
          name,
          message:
            'Wall-clock deadlines make replay hardware-dependent (ADR 0034 §4).',
        })),
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[property.name='now']",
          message:
            'The clock may not influence a ply; depth is fixed (ADR 0005, ADR 0034 §4).',
        },
      ],
    },
  },
  prettier,
);
