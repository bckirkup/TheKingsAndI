import { availableParallelism } from 'node:os';

/**
 * Test files whose every case runs campaign- or corpus-scale work. They are
 * behaviour measurements rather than harness correctness checks, so the fast
 * tier does not load them at all. Files that mix the two tiers instead mark
 * their slow cases with `skipIf(FAST_TIER_ONLY)` from `tests/tier.ts`, so the
 * cheap unit and wiring cases stay on the PR gate. Costs are the wall clock
 * measured on a GitHub-hosted runner.
 */
export const HEAVY_TEST_FILES = [
  'tests/world.test.ts', // 426 s — pairing layer style matrix, two whole matches per case
  'tests/sim.trajectory.test.ts', // trajectory-band campaign measurement
  'tests/sim.sweep.test.ts', // coefficient sweep
  'tests/chess.board.fuzz.test.ts', // large identity-fuzz corpus
] as const;

const workerCount = availableParallelism();

/**
 * `VITEST_TIER` is set here rather than by the package script so that the tier
 * is the same on every platform and for editor-driven runs.
 */
export function sharedTestConfig(tier: 'fast' | 'heavy') {
  return {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: workerCount,
        maxThreads: workerCount,
      },
    },
    env: {
      VITEST_TIER: tier,
    },
    coverage: {
      provider: 'v8' as const,
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
    },
  };
}
