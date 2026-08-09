import { availableParallelism } from 'node:os';
import { defineConfig } from 'vitest/config';

const workerCount = availableParallelism();

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    pool: 'threads',
    poolOptions: {
      threads: {
        minThreads: workerCount,
        maxThreads: workerCount,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
    },
  },
});
