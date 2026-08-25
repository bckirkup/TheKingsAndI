import { describe, expect, it } from 'vitest';

import {
  cohortFrozenCliqueFinding,
  cohortHistoryDegeneracyFindings,
  cohortInertPastFinding,
  type CohortHistoryObservations,
} from '../sim/degeneracy';

function observations(sharedIntakeDrafts: number): CohortHistoryObservations {
  return {
    cycles: [
      {
        cycle: 1,
        draftedCandidates: 4,
        sharedIntakeDrafts,
        counselOpinionTotal: 2,
        counselOpinionCount: 4,
        counselOpinions: [2, 1, 0, -1],
        counselReasonCounts: {
          'personal affinity': 1,
          'class prejudice': 1,
          'chair rivalry': 1,
          'mixed evidence': 1,
        },
        desertions: 1,
        retirements: 0,
        commendationsAwarded: 1,
      },
    ],
  };
}

describe('cohort history degeneracy detectors', () => {
  it('detects a populated run identical to its density-zero control', () => {
    expect(cohortInertPastFinding(observations(0), observations(0))?.code).toBe(
      'inert_past',
    );
    expect(
      cohortHistoryDegeneracyFindings(observations(0), observations(0)).map(
        (finding) => finding.code,
      ),
    ).toContain('inert_past');
  });

  it('fires frozen-clique only above the configured fraction', () => {
    expect(cohortFrozenCliqueFinding(observations(2), 4, 0.75)).toBeUndefined();
    expect(cohortFrozenCliqueFinding(observations(4), 4, 0.75)?.code).toBe(
      'frozen_clique',
    );
    expect(cohortFrozenCliqueFinding(observations(3), 4, 0.5)?.code).toBe(
      'frozen_clique',
    );
  });
});
