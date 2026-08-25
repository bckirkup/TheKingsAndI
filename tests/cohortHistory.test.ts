import { describe, expect, it } from 'vitest';

import {
  COHORT_HISTORY_CONFIG,
  generateCohortHistory,
} from '../src/core/cohortHistory';

describe('cohort history generation', () => {
  it('is deterministic and zero-density by default', () => {
    const members = ['b', 'a', 'c'];
    const first = generateCohortHistory(members, 17);
    expect(first.relations).toEqual([]);
    expect(Object.keys(first.intakeByMember).sort()).toEqual(['a', 'b', 'c']);
    expect(generateCohortHistory(members, 17)).toEqual(first);
    expect(COHORT_HISTORY_CONFIG.RELATIONS_PER_PIECE).toBe(0);
  });

  it('chunks members, avoids self rows, and emits symmetric and asymmetric rows', () => {
    const history = generateCohortHistory(['d', 'c', 'b', 'a', 'e', 'f'], 8, {
      ...COHORT_HISTORY_CONFIG,
      INTAKE_SIZE: 2,
      RELATIONS_PER_PIECE: 8,
      CROSS_INTAKE_TAIL_PERMILLE: 1_000,
    });
    expect(history.intakeByMember).toEqual({
      a: 0,
      f: 0,
      c: 1,
      e: 1,
      d: 2,
      b: 2,
    });
    expect(history.relations.every((row) => row.from !== row.to)).toBe(true);
    expect(
      history.relations.some((row) => row.type === 'served_together'),
    ).toBe(true);
    expect(history.relations.some((row) => row.type === 'owes')).toBe(true);
    for (const row of history.relations) {
      if (row.type !== 'served_together' && row.type !== 'bereaved_together') {
        continue;
      }
      expect(history.relations).toContainEqual({
        from: row.to,
        to: row.from,
        type: row.type,
        weight: row.weight,
      });
    }
  });

  it('permutes sorted members reproducibly before mixing intake groups', () => {
    const members = [
      'pool:a',
      'pool:b',
      'pool:c',
      'pool:d',
      'market:a',
      'market:b',
      'market:c',
      'market:d',
    ];
    const config = {
      ...COHORT_HISTORY_CONFIG,
      INTAKE_SIZE: 2,
    };
    const first = generateCohortHistory(members, 2, config);
    const reordered = generateCohortHistory([...members].reverse(), 2, config);
    expect(reordered).toEqual(first);
    const intakes = new Set(Object.values(first.intakeByMember));
    expect(
      [...intakes].some((intake) => {
        const ids = Object.entries(first.intakeByMember)
          .filter(([, candidateIntake]) => candidateIntake === intake)
          .map(([id]) => id);
        return (
          ids.some((id) => id.startsWith('pool:')) &&
          ids.some((id) => id.startsWith('market:'))
        );
      }),
    ).toBe(true);
  });

  it('keeps local and cross-intake target selection configurable', () => {
    const local = generateCohortHistory(['a', 'b', 'c', 'd'], 9, {
      ...COHORT_HISTORY_CONFIG,
      INTAKE_SIZE: 2,
      RELATIONS_PER_PIECE: 1,
      CROSS_INTAKE_TAIL_PERMILLE: 0,
    });
    const cross = generateCohortHistory(['a', 'b', 'c', 'd'], 9, {
      ...COHORT_HISTORY_CONFIG,
      INTAKE_SIZE: 2,
      RELATIONS_PER_PIECE: 1,
      CROSS_INTAKE_TAIL_PERMILLE: 1_000,
    });
    const hasCross = (history: typeof local) =>
      history.relations.some(
        (row) =>
          history.intakeByMember[row.from] !== history.intakeByMember[row.to],
      );
    expect(hasCross(local)).toBe(false);
    expect(hasCross(cross)).toBe(true);
  });
});
