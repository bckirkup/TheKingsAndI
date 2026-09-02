import { describe, expect, it } from 'vitest';

import { defaultCredence } from '../src/psychology';
import { runCampaign, type CampaignCheckpoint } from '../sim/campaign';

describe('campaign roster state carry', () => {
  it('preserves a captured piece when it re-fields in the next match', async () => {
    const checkpoints: CampaignCheckpoint[] = [];
    const result = await runCampaign({
      seed: 7,
      matches: 2,
      leader: 'tyrannical',
      opponent: 'supportive',
      engineKind: 'fake',
      initialTrust: 100,
      onCheckpoint: (checkpoint) => {
        checkpoints.push(checkpoint);
      },
    });

    expect(checkpoints).toHaveLength(2);
    expect(result.metrics[0]?.survivingRosterSize).toBe(2);

    const firstMatchState = checkpoints[0]?.roster.find(
      (piece) => piece.id === 'w:P:g2',
    );
    expect(result.metrics[1]?.fieldedPieceIds).toContain('w:P:g2');
    expect(firstMatchState).toBeDefined();
    if (firstMatchState === undefined) return;
    expect(firstMatchState.B_i).toBeGreaterThan(0);
    expect(Object.keys(firstMatchState.dyadicAffinity)).not.toHaveLength(0);
    expect(firstMatchState.credence).not.toEqual(defaultCredence());

    const secondMatchState = checkpoints[1]?.roster.find(
      (piece) => piece.id === firstMatchState.id,
    );
    expect(secondMatchState).toBeDefined();
    if (secondMatchState === undefined) return;
    expect(secondMatchState.B_i).toBeGreaterThan(0);
    expect(Object.keys(secondMatchState.dyadicAffinity)).not.toHaveLength(0);
    expect(secondMatchState.credence).not.toEqual(defaultCredence());
  });
});
