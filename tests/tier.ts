import { describe, it } from 'vitest';

/**
 * Test tiering. `pnpm test` (vitest.config.ts) sets `VITEST_TIER=fast` and is
 * what the PR gate runs; `pnpm test:heavy` (vitest.heavy.config.ts) sets
 * `heavy` and is what nightly runs.
 *
 * Files that are campaign-scale throughout are listed in `HEAVY_TEST_FILES`
 * (vitest.shared.ts) and are not loaded by the fast tier at all. Files that mix
 * cheap wiring checks with a few whole-campaign runs declare only the expensive
 * cases with `itHeavy` / `describeHeavy`, so their unit cases keep running on
 * every push. See docs/testing_strategy.md §7.
 */
const FAST_TIER = process.env.VITEST_TIER === 'fast';

/** A case that runs a whole campaign, season, or semester: nightly only. */
export const itHeavy = it.skipIf(FAST_TIER);

/** A suite whose every case is campaign-scale: nightly only. */
export const describeHeavy = describe.skipIf(FAST_TIER);
