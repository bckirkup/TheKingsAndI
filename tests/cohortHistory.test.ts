import { describe, expect, it } from 'vitest';

import {
  COHORT_HISTORY_CONFIG,
  generateCohortHistory,
} from '../src/core/cohortHistory';

describe('cohort history generation', () => {
  it('is deterministic, sorted, and zero-density by default', () => {
    const members = ['b', 'a', 'c'];
    const first = generateCohortHistory(members, 17);
    expect(first).toEqual({
      intakeByMember: { a: 0, b: 0, c: 0 },
      relations: [],
    });
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
      b: 0,
      c: 1,
      d: 1,
      e: 2,
      f: 2,
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
