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
        consultedAffinityPairs: 0,
        consultedIntakePairs: 0,
        acquisitionsWithAffinity: 0,
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

  it('ignores downstream noise when draft decisions match', () => {
    const populated = observations(0);
    const control = observations(0);
    const cycle = populated.cycles[0];
    if (cycle === undefined) throw new Error('Missing cohort cycle fixture.');
    const noisy = {
      ...cycle,
      desertions: 99,
      commendationsAwarded: 0,
    };
    expect(
      cohortInertPastFinding({ cycles: [noisy] }, control)?.message,
    ).toContain('draft picks and counsel opinions');
  });

  it('requires both draft picks and counsel opinions to match', () => {
    const populated = observations(0);
    const control = observations(0);
    const cycle = populated.cycles[0];
    if (cycle === undefined) throw new Error('Missing cohort cycle fixture.');
    expect(
      cohortInertPastFinding(
        { cycles: [{ ...cycle, draftedCandidates: 3 }] },
        control,
      ),
    ).toBeUndefined();
  });

  it('fires frozen-clique only when populated history beats its control', () => {
    const populated = observations(4);
    const control = observations(0);
    const cycle = populated.cycles[0];
    if (cycle === undefined) throw new Error('Missing cohort cycle fixture.');
    const touched = {
      ...cycle,
      acquisitionsWithAffinity: 1,
    };
    const halfShared = { ...touched, sharedIntakeDrafts: 2 };
    expect(
      cohortFrozenCliqueFinding({ cycles: [halfShared] }, control, 4, 0.25)
        ?.code,
    ).toBe('frozen_clique');
    expect(
      cohortFrozenCliqueFinding({ cycles: [halfShared] }, control, 4, 0.5),
    ).toBeUndefined();
    expect(
      cohortFrozenCliqueFinding({ cycles: [halfShared] }, control, 4, 0.75),
    ).toBeUndefined();
  });

  it('reports when a draft never ran without calling the past inert', () => {
    const cycle = observations(0).cycles[0];
    if (cycle === undefined) throw new Error('Missing cohort cycle fixture.');
    const neverRan: CohortHistoryObservations = {
      cycles: [
        {
          ...cycle,
          draftedCandidates: 0,
          counselOpinionCount: 0,
          counselOpinionTotal: 0,
          counselOpinions: [],
        },
      ],
    };
    expect(cohortInertPastFinding(neverRan, neverRan)).toBeUndefined();
    expect(
      cohortHistoryDegeneracyFindings(neverRan, neverRan).map(
        (finding) => finding.code,
      ),
    ).toEqual(['draft_never_ran']);
  });
});
