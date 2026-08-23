import { describe, expect, it } from 'vitest';

import {
  assembleMatchRecord,
  AUDIT_FOLD_VERSION,
  foldPlayerCommendations,
  publicMatchFactsFromRecord,
  foldPublicRegister,
} from '../src/persistence';
import { runSeminar, seminarPayload } from '../sim/seminar';

describe('seminar spine', () => {
  it('shares pure match-record assembly with persistence-shaped inputs', () => {
    const record = assembleMatchRecord({
      campaignId: 'c1',
      actId: 'a1',
      matchIndex: 1,
      seed: 7,
      rosterSnapshot: [],
      rosterEnd: [],
      events: [],
      result: 'DRAW',
    });
    expect(record.audit.foldVersion).toBe(AUDIT_FOLD_VERSION);
    expect(record.engineAudit).toEqual([]);
    expect(record.result).toBe('DRAW');
  });

  it('settles each week into registers and commendations', async () => {
    const result = await runSeminar({
      seed: 19,
      config: {
        WEEKS_PER_SEMESTER: 1,
        MATCHES_PER_WEEK: 1,
        COMMANDERS_PER_COHORT: 1,
      },
      engineKind: 'fake',
    });
    expect(result.weeks).toHaveLength(1);
    expect(result.commanders).toHaveLength(2);
    for (const commander of result.commanders) {
      expect(commander.register.matchesPlayed).toBe(1);
      expect(commander.commendations).toEqual(
        foldPlayerCommendations(
          result.weeks[0]?.records[commander.commander.id] ?? [],
        ),
      );
      expect(
        foldPublicRegister(
          (result.weeks[0]?.records[commander.commander.id] ?? []).map(
            (record) =>
              publicMatchFactsFromRecord(record, commander.commander.side),
          ),
        ),
      ).toEqual(result.weeks[0]?.registerDeltas[commander.commander.id]);
    }
  });

  it('repeats a semester byte-identically for the same seed', async () => {
    const options = {
      seed: 23,
      config: {
        WEEKS_PER_SEMESTER: 1,
        MATCHES_PER_WEEK: 1,
        COMMANDERS_PER_COHORT: 1,
      },
      engineKind: 'fake' as const,
    };
    expect(seminarPayload(await runSeminar(options))).toBe(
      seminarPayload(await runSeminar(options)),
    );
  });

  it('wires each loop dimension into the output', async () => {
    const base = {
      seed: 29,
      config: {
        WEEKS_PER_SEMESTER: 1,
        MATCHES_PER_WEEK: 1,
        COMMANDERS_PER_COHORT: 1,
      },
      engineKind: 'fake' as const,
    };
    const weeks = await runSeminar({
      ...base,
      config: { ...base.config, WEEKS_PER_SEMESTER: 2 },
    });
    const matches = await runSeminar({
      ...base,
      config: { ...base.config, MATCHES_PER_WEEK: 2 },
    });
    const commanders = await runSeminar({
      ...base,
      config: { ...base.config, COMMANDERS_PER_COHORT: 2 },
    });
    expect(weeks.weeks).toHaveLength(2);
    expect(matches.weeks[0]?.records['w:commander:00']).toHaveLength(2);
    expect(commanders.commanders).toHaveLength(4);
    expect(weeks.weeks.length).not.toBe(base.config.WEEKS_PER_SEMESTER);
    expect(matches.weeks[0]?.records['w:commander:00']?.length).not.toBe(
      base.config.MATCHES_PER_WEEK,
    );
    expect(commanders.commanders.length).not.toBe(
      base.config.COMMANDERS_PER_COHORT * 2,
    );
  });
});
