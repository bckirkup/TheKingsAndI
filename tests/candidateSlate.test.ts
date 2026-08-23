import { describe, expect, it } from 'vitest';

import { bootstrapRoster } from '../src/app/careerBootstrap';
import {
  foldPublicCandidateSlate,
  publicCandidateSlateFromRecords,
  type PublicCandidateSlateInput,
} from '../src/persistence';
import { defaultCredence } from '../src/psychology';

const serviceRecord = {
  matchesServed: 2,
  ordersCarriedOut: 1,
  ordersFatalistic: 0,
  ordersQuietlyQuit: 0,
  ordersRefused: 0,
  ordersOverridden: 0,
  capturesMade: 0,
  timesTaken: 0,
  timesCoveredComrade: 0,
  heroismNominations: 0,
  timesBenched: 0,
  timesFired: 0,
  timesRecruited: 0,
  promotions: 0,
  deserted: false,
  timesPassedOver: 0,
} as const;

describe('public candidate slate', () => {
  it('folds exactly the public candidate facts', () => {
    const candidate: PublicCandidateSlateInput = {
      id: 'w:Pawn:00',
      name: 'Rosalind',
      originRole: 'Pawn',
      attainedRole: 'Queen',
      status: 'ACTIVE',
      commandersServed: ['commander-b', 'commander-a'],
      serviceRecord,
    };
    const entry = foldPublicCandidateSlate([candidate]).candidates[0];
    expect(entry).toEqual({
      id: 'w:Pawn:00',
      name: 'Rosalind',
      originRole: 'Pawn',
      attainedRole: 'Queen',
      status: 'ACTIVE',
      commandersServed: ['commander-a', 'commander-b'],
      serviceRecord,
    });
    expect(Object.keys(entry ?? {}).sort()).toEqual(
      [
        'id',
        'name',
        'originRole',
        'attainedRole',
        'status',
        'commandersServed',
        'serviceRecord',
      ].sort(),
    );
  });

  it('uses persisted relationship-account keys for commanders served', () => {
    const bootstrapped = bootstrapRoster(17);
    const sourceIdentity = bootstrapped.identities[0];
    const piece = bootstrapped.roster[0];
    if (sourceIdentity === undefined || piece === undefined) {
      throw new Error('Missing bootstrap fixture.');
    }
    const identity = {
      ...sourceIdentity,
      relationshipAccounts: {
        'leader-z': defaultCredence(),
        'leader-a': defaultCredence(),
      },
    };
    const slate = publicCandidateSlateFromRecords({
      identities: [identity],
      roster: [piece],
      matches: [],
    });
    expect(slate.candidates[0]?.commandersServed).toEqual([
      'leader-a',
      'leader-z',
    ]);
    expect(slate.candidates[0]?.serviceRecord.matchesServed).toBe(0);
    const leaked = JSON.stringify(slate);
    expect(leaked).not.toContain('tauBenev');
    expect(leaked).not.toContain('T_i');
    expect(leaked).not.toContain('E_i');
  });
});
