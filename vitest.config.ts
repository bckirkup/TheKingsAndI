import { configDefaults, defineConfig } from 'vitest/config';

import { HEAVY_TEST_FILES, sharedTestConfig } from './vitest.shared';

// The fast tier, and the default for `pnpm test`: no campaign-scale files, and
// the campaign-scale cases inside mixed files skip themselves on VITEST_TIER.
// See docs/testing_strategy.md §7.
export default defineConfig({
  test: {
    ...sharedTestConfig('fast'),
    exclude: [...configDefaults.exclude, ...HEAVY_TEST_FILES],
  },
});
