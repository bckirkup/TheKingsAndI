import { describe, expect, it } from 'vitest';

import { ENGINE_CONFIG } from '../src/psychology';
import { disposeSimEngine } from '../sim/engine';
import { runCampaign } from '../sim/campaign';

describe('campaign carrier telemetry', () => {
  it('grades shame exposure telemetry with the configured witness rate', async () => {
    const cfg = ENGINE_CONFIG as unknown as Record<string, number>;
    const original = cfg.SHAME_PER_WITNESS_PERMILLE ?? 0;
    try {
      cfg.SHAME_PER_WITNESS_PERMILLE = 0;
      const result = await runCampaign({
        matches: 2,
        leader: 'tyrannical',
        opponent: 'tyrannical',
        seed: 7,
        engineKind: 'fake',
        depthCap: 1,
        onCheckpoint: (checkpoint) => {
          if (checkpoint.nextMatch === 2) {
            cfg.SHAME_PER_WITNESS_PERMILLE = 100;
          }
        },
      });
      expect(result.metrics[0]?.shameExposures).toBe(0);
      expect(result.metrics[1]?.shameExposures).toBeGreaterThan(0);
    } finally {
      cfg.SHAME_PER_WITNESS_PERMILLE = original;
      await disposeSimEngine('fake');
    }
  }, 10_000);
});
