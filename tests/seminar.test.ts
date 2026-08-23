import { describe, expect, it } from 'vitest';

import {
  assembleMatchRecord,
  AUDIT_FOLD_VERSION,
  foldPlayerCommendations,
  publicMatchFactsFromRecord,
  foldPublicRegister,
} from '../src/persistence';
import {
  classifySeminarSideResult,
  runSeminar,
  seminarPayload,
  standingsFor,
} from '../sim/seminar';
import { SEMINAR_CONFIG } from '../sim/seminarConfig';
import { createSeminarMarkets, runSeminarDraft } from '../sim/seminarDraft';
import { createCommanderPool, type CommanderPool } from '../sim/pool';
import {
  dispositionForIdentitySeed,
  identityCreationSeed,
} from '../src/orchestration';

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
        ...SEMINAR_CONFIG,
        WEEKS_PER_SEMESTER: 1,
        MATCHES_PER_WEEK: 1,
        COMMANDERS_PER_COHORT: 1,
      },
      engineKind: 'fake',
    });
    expect(result.weeks).toHaveLength(1);
    expect(result.commanders).toHaveLength(2);
    for (const commander of result.commanders) {
      const record = result.weeks[0]?.records[commander.commander.id]?.[0];
      expect(record).toBeDefined();
      if (record === undefined) throw new Error('Seminar record is missing.');
      const facts = publicMatchFactsFromRecord(
        record,
        commander.commander.side,
      );
      expect(facts.startingRoles.map((role) => role.pieceId).sort()).toEqual(
        result.weeks[0]?.fieldedLineups[commander.commander.id]?.[0]?.sort(),
      );
      expect(
        record?.rosterSnapshot.every((piece) => piece.status === 'ACTIVE'),
      ).toBe(true);
      expect(record?.rosterSnapshot).not.toHaveLength(31);
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
    const payload = seminarPayload(result);
    expect(payload).toContain('recordDigests');
    expect(payload).not.toContain('"events"');
    expect(payload).not.toContain('"records"');
  });

  it('repeats a semester byte-identically for the same seed', async () => {
    const options = {
      seed: 23,
      config: {
        ...SEMINAR_CONFIG,
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
        ...SEMINAR_CONFIG,
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

  it('carries pool state into week two and settles a new register', async () => {
    const result = await runSeminar({
      seed: 31,
      config: {
        ...SEMINAR_CONFIG,
        WEEKS_PER_SEMESTER: 2,
        MATCHES_PER_WEEK: 1,
        COMMANDERS_PER_COHORT: 1,
      },
      engineKind: 'fake',
    });
    const first = result.weeks[0];
    const second = result.weeks[1];
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    const commanderId = 'w:commander:00';
    expect(first?.poolStates[commanderId]).not.toEqual(
      second?.poolStates[commanderId],
    );
    expect(first?.registerDeltas[commanderId]).not.toEqual(
      second?.registerDeltas[commanderId],
    );
  });

  it('keeps cycle-one drafting opt-in and wires seminar counsel controls', async () => {
    const base = {
      seed: 37,
      config: {
        ...SEMINAR_CONFIG,
        WEEKS_PER_SEMESTER: 2,
        MATCHES_PER_WEEK: 1,
        COMMANDERS_PER_COHORT: 1,
      },
      engineKind: 'fake' as const,
    };
    const disabled = await runSeminar(base);
    const enabled = await runSeminar({
      ...base,
      config: { ...base.config, DRAFT_AT_CYCLE_ONE: true },
    });
    expect(disabled.weeks[0]?.draftEconomy.clearingPrices).toEqual([]);
    expect(enabled.draftEconomy.standingSeries.length).toBeGreaterThan(0);
    const noConsultations = await runSeminar({
      ...base,
      config: {
        ...base.config,
        DRAFT_CONSULTATIONS_PER_CYCLE: 0,
      },
    });
    expect(noConsultations.counselCorrelationPairs.length).toBeLessThanOrEqual(
      enabled.counselCorrelationPairs.length,
    );
  });

  it('wires counsel budget and willingness weight into draft decisions', () => {
    const commander = {
      id: 'w:commander:00',
      side: 'w' as const,
      style: 'tyrannical' as const,
    };
    const blackCommander = {
      id: 'b:commander:00',
      side: 'b' as const,
      style: 'tyrannical' as const,
    };
    const fullPool = createCommanderPool({
      id: commander.id,
      side: commander.side,
      style: commander.style,
      careerSeed: 7,
    });
    const pool = {
      ...fullPool,
      members: fullPool.members.filter(
        (member) => member.originRole !== 'Queen',
      ),
    };
    const blackPool = createCommanderPool({
      id: blackCommander.id,
      side: blackCommander.side,
      style: blackCommander.style,
      careerSeed: 8,
    });
    const pools = new Map<string, CommanderPool>([
      [commander.id, pool],
      [blackCommander.id, blackPool],
    ]);
    const markets = createSeminarMarkets(7, pools);
    const initialWhiteMarket = markets.get('w');
    expect(initialWhiteMarket?.members.length).toBeGreaterThan(0);
    const marketQueen = initialWhiteMarket?.members.find(
      (member) => member.originRole === 'Queen',
    );
    expect(marketQueen?.state.credence.tauBenev).toBe(50);
    if (marketQueen === undefined || initialWhiteMarket === undefined) {
      throw new Error('Seminar market did not include a queen candidate.');
    }
    expect(
      new Set(initialWhiteMarket.members.map((member) => member.state.id)).size,
    ).toBe(initialWhiteMarket.members.length);
    expect(marketQueen.state.credence).toEqual(
      dispositionForIdentitySeed(identityCreationSeed(7, marketQueen.state.id)),
    );
    expect(markets.get('b')?.members.length).toBe(
      initialWhiteMarket.members.length,
    );
    const draftMarkets = new Map(markets);
    draftMarkets.set('w', {
      side: 'w',
      members: initialWhiteMarket.members.map((member) =>
        member.state.id === marketQueen.state.id
          ? {
              ...member,
              state: {
                ...member.state,
                credence: { ...member.state.credence, tauBenev: 100 },
              },
            }
          : member,
      ),
    });
    const standings = [
      { commanderId: commander.id, standing: 0, cohortExternality: 0 },
      {
        commanderId: blackCommander.id,
        standing: 0,
        cohortExternality: 0,
      },
    ];
    const base = {
      cycle: 2,
      seed: 7,
      commanders: [commander, blackCommander],
      pools,
      markets: draftMarkets,
      standings,
      registers: new Map(),
      previousPurses: new Map(),
      config: {
        ...SEMINAR_CONFIG,
        DRAFT_CONSULTATIONS_PER_CYCLE: 4,
      },
    };
    const noCounsel = runSeminarDraft({
      ...base,
      config: { ...base.config, DRAFT_COUNSEL_WILLINGNESS_WEIGHT_PERMILLE: 0 },
    });
    const counsel = runSeminarDraft(base);
    const noBudget = runSeminarDraft({
      ...base,
      config: { ...base.config, DRAFT_CONSULTATIONS_PER_CYCLE: 0 },
    });
    expect(noBudget.counselSelections.length).toBeLessThanOrEqual(
      counsel.counselSelections.length,
    );
    expect(noCounsel.willingnessByCommander.get(commander.id)).not.toEqual(
      counsel.willingnessByCommander.get(commander.id),
    );
    expect(
      Object.values(
        noCounsel.willingnessByCommander.get(commander.id) ?? {},
      )[0],
    ).toBe(1000);
    expect(noBudget.willingnessByCommander.get(commander.id)).toEqual({});
    expect(counsel.markets.get('w')?.members.length ?? 0).toBeLessThan(
      initialWhiteMarket?.members.length ?? 0,
    );
  });

  it('mirrors black WIN, LOSS, and DRAW from discrete scores', () => {
    const base = { rout: false, enemyRout: false, winScore: 100 };
    expect(classifySeminarSideResult(base, 'b')).toBe('LOSS');
    expect(classifySeminarSideResult({ ...base, winScore: 0 }, 'b')).toBe(
      'WIN',
    );
    expect(classifySeminarSideResult({ ...base, winScore: 50 }, 'b')).toBe(
      'DRAW',
    );
  });

  it('wires each standing weight into CommanderStanding output', () => {
    const commanders = [
      {
        id: 'w:commander:00',
        side: 'w' as const,
        style: 'servant' as const,
      },
      {
        id: 'b:commander:00',
        side: 'b' as const,
        style: 'servant' as const,
      },
    ];
    const records = new Map([
      [
        'w:commander:00',
        [
          assembleMatchRecord({
            campaignId: 'c',
            actId: 'a',
            matchIndex: 1,
            seed: 1,
            rosterSnapshot: [],
            rosterEnd: [],
            events: [],
            result: 'WIN',
          }),
        ],
      ],
      [
        'b:commander:00',
        [
          assembleMatchRecord({
            campaignId: 'c',
            actId: 'a',
            matchIndex: 1,
            seed: 1,
            rosterSnapshot: [],
            rosterEnd: [],
            events: [],
            result: 'LOSS',
          }),
        ],
      ],
    ]);
    const winValues = [0, 3, 6].map((weight) =>
      standingsFor(commanders, records, {
        ...SEMINAR_CONFIG,
        STANDING_WIN_WEIGHT: weight,
      }).map((standing) => standing.standing),
    );
    const lossValues = [0, -1, -2].map((weight) =>
      standingsFor(commanders, records, {
        ...SEMINAR_CONFIG,
        STANDING_LOSS_WEIGHT: weight,
      }).map((standing) => standing.standing),
    );
    const drawRecord = assembleMatchRecord({
      campaignId: 'c',
      actId: 'a',
      matchIndex: 2,
      seed: 2,
      rosterSnapshot: [],
      rosterEnd: [],
      events: [],
      result: 'DRAW',
    });
    const drawValues = [0, 1, 2].map((weight) =>
      standingsFor(
        commanders,
        new Map([
          ['w:commander:00', [drawRecord]],
          ['b:commander:00', [drawRecord]],
        ]),
        { ...SEMINAR_CONFIG, STANDING_DRAW_WEIGHT: weight },
      ).map((standing) => standing.standing),
    );
    expect(new Set(winValues.map((values) => values.join(','))).size).toBe(3);
    expect(new Set(lossValues.map((values) => values.join(','))).size).toBe(3);
    expect(new Set(drawValues.map((values) => values.join(','))).size).toBe(3);
    expect(standingsFor(commanders, records, SEMINAR_CONFIG)[0]).toMatchObject({
      commanderId: expect.any(String),
      standing: expect.any(Number),
      cohortExternality: expect.any(Number),
    });
  });
});
