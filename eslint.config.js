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

/**
 * Modules that reach `node:child_process` / `node:os` and therefore cannot
 * appear anywhere in the browser bundle's import graph (`pnpm build` fails
 * with "spawn is not exported by __vite-browser-external"). Type-only imports
 * are erased and stay allowed. `engine/uci` itself is browser-safe — it is
 * the transport interface the Web Worker host implements (ADR 0079); the
 * Node child-process transport is `engine/uciNode`.
 */
const nodeOnlyEngineModules = [
  '**/engine/node',
  '**/engine/broker',
  '**/engine/pool',
  '**/engine/uciNode',
  '**/engine/adapters/**',
];

const nodeOnlyEngineGroup = {
  group: nodeOnlyEngineModules,
  allowTypeImports: true,
  message:
    'This module ships in the browser bundle; the engine pool, UCI transport, broker, and real adapters are Node-only. Inject an EnginePort instead.',
};

const boundaryRule = (patterns, { nodeOnlyEngine = true } = {}) => ({
  '@typescript-eslint/no-restricted-imports': [
    'error',
    {
      patterns: [
        ...patterns.map((group) => ({
          group: [group],
          message: 'Layer imports must flow downward only.',
        })),
        ...(nodeOnlyEngine ? [nodeOnlyEngineGroup] : []),
      ],
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
    // App is a composition root: it may construct an EnginePort (ADR 0020)
    // and inject it into orchestration. UI still must not.
    name: 'app-layer-boundary',
    files: ['src/app/**'],
    rules: boundaryRule([]),
  },
  {
    name: 'ui-layer-boundary',
    files: ['src/ui/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            ...[...higherLayers.ui, '**/engine/**'].map((group) => ({
              group: [group],
              message: 'Layer imports must flow downward only.',
            })),
            nodeOnlyEngineGroup,
            {
              group: ['**/psychology', '**/psychology/**'],
              importNames: ['PieceState'],
              message:
                'D219 glass screen: ui/ may not import PieceState; consume ObservationPiece.',
            },
          ],
        },
      ],
    },
  },
  {
    // Orchestration owns the barrier call site (ADR 0034) and may import
    // engine types + barrier/cache/round. Adapters stay constructed at roots.
    name: 'orchestration-layer-boundary',
    files: ['src/orchestration/**'],
    rules: boundaryRule(higherLayers.orchestration),
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
    rules: boundaryRule(higherLayers.engine, { nodeOnlyEngine: false }),
  },
  {
    // The browser-safe half of the engine layer: `src/app` imports it, so it
    // must stay clear of the Node-only half. Includes the Lozza Web Worker
    // host and the host-neutral pieces it shares with the Node adapter.
    name: 'engine-browser-surface',
    files: [
      'src/engine/index.ts',
      'src/engine/barrier.ts',
      'src/engine/cache.ts',
      'src/engine/conformanceCorpus.ts',
      'src/engine/fake.ts',
      'src/engine/lozzaArtifact.ts',
      'src/engine/lozzaCore.ts',
      'src/engine/round.ts',
      'src/engine/search.ts',
      'src/engine/types.ts',
      'src/engine/uci.ts',
      'src/engine/workerLozza.ts',
    ],
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
    // ADR 0004 + ADR 0062: no runtime LLM in the shipped package. Model calls
    // exist only under sim/ as instruments producing decision journals; a
    // journal — never a client — is what may ship. Content authoring
    // (dialogue, pack text) is offline generation committed as assets, not an
    // import.
    name: 'no-runtime-llm',
    files: ['src/**', 'tests/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'openai',
                '@anthropic-ai/*',
                '@google/genai',
                '@google/generative-ai',
                '@langchain/*',
                'langchain',
                'cohere-ai',
                '@mistralai/*',
                'ollama',
                '@azure/openai',
                '@aws-sdk/client-bedrock*',
                'replicate',
              ],
              message:
                'ADR 0004/0062: no runtime LLM. Model calls live under sim/ only, producing replayable decision journals.',
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
