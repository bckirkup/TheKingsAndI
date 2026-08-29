import { defineConfig } from 'vitest/config';

import { sharedTestConfig } from './vitest.shared';

// The heavy tier, which nightly owns: every file, with the campaign-scale cases
// enabled. A positional filter selects a single file, which is how the nightly
// matrix runs them one per job.
export default defineConfig({
  test: sharedTestConfig('heavy'),
});
