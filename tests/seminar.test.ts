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
import {
  createSeminarMarkets,
  publicLotBasePrice,
  runSeminarDraft,
} from '../sim/seminarDraft';
import {
  createCommanderPool,
  poolSeasonMetrics,
  type CommanderPool,
} from '../sim/pool';
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

  it('keeps drafted members distinct in pool metrics', () => {
    const pool = createCommanderPool({
      id: 'w:commander:00',
      side: 'w',
      style: 'servant',
      careerSeed: 41,
    });
    const black = createCommanderPool({
      id: 'b:commander:00',
      side: 'b',
      style: 'servant',
      careerSeed: 42,
    });
    const market = createSeminarMarkets(
      41,
      new Map([
        [pool.id, pool],
        [black.id, black],
      ]),
    ).get('w');
    const drafted = market?.members[0];
    if (drafted === undefined) throw new Error('Missing market candidate.');
    const withDraft = {
      ...pool,
      members: [...pool.members, drafted],
    };
    const metrics = poolSeasonMetrics({
      initialPool: withDraft,
      finalPool: withDraft,
      lineups: [[drafted.state.id]],
      promotionMatches: new Map(),
    });
    expect(metrics.draftedMembers).toBe(1);
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

  it('treats unavailable members as absent only in the strict demand branch', () => {
    const white = createCommanderPool({
      id: 'w:commander:00',
      side: 'w',
      style: 'servant',
      careerSeed: 51,
    });
    const black = createCommanderPool({
      id: 'b:commander:00',
      side: 'b',
      style: 'servant',
      careerSeed: 52,
    });
    const unavailableWhite = {
      ...white,
      members: white.members.map((member) =>
        member.originRole === 'Queen'
          ? { ...member, status: 'recovering' as const }
          : member,
      ),
    };
    const pools = new Map<string, CommanderPool>([
      [unavailableWhite.id, unavailableWhite],
      [black.id, black],
    ]);
    const markets = createSeminarMarkets(51, pools);
    const base = {
      cycle: 2,
      seed: 51,
      commanders: [
        { id: white.id, side: 'w' as const, style: 'servant' as const },
        { id: black.id, side: 'b' as const, style: 'servant' as const },
      ],
      pools,
      markets,
      standings: [
        { commanderId: white.id, standing: 0, cohortExternality: 0 },
        { commanderId: black.id, standing: 0, cohortExternality: 0 },
      ],
      registers: new Map(),
      previousPurses: new Map(),
      firstMatch: 1,
      config: {
        ...SEMINAR_CONFIG,
        DRAFT_CONSULTATIONS_PER_CYCLE: 0,
      },
    };
    const strict = runSeminarDraft(base);
    const countUnavailable = runSeminarDraft({
      ...base,
      config: { ...base.config, DRAFT_COUNT_UNAVAILABLE_AS_PRESENT: true },
    });
    expect(strict.observation.clearingPrices.length).toBeGreaterThan(0);
    expect(countUnavailable.observation.clearingPrices).toHaveLength(0);
  });

  it('keeps a candidate unfilled when the winning commander underbids her price', () => {
    const white = createCommanderPool({
      id: 'w:commander:00',
      side: 'w',
      style: 'tyrannical',
      careerSeed: 61,
    });
    const black = createCommanderPool({
      id: 'b:commander:00',
      side: 'b',
      style: 'tyrannical',
      careerSeed: 62,
    });
    const whiteWithoutQueen = {
      ...white,
      members: white.members.filter((member) => member.originRole !== 'Queen'),
    };
    const pools = new Map<string, CommanderPool>([
      [white.id, whiteWithoutQueen],
      [black.id, black],
    ]);
    const market = createSeminarMarkets(61, pools);
    const queen = market
      .get('w')
      ?.members.find((member) => member.originRole === 'Queen');
    if (queen === undefined) throw new Error('Missing queen candidate.');
    const result = runSeminarDraft({
      cycle: 2,
      seed: 61,
      commanders: [
        { id: white.id, side: 'w', style: 'tyrannical' },
        { id: black.id, side: 'b', style: 'tyrannical' },
      ],
      pools,
      markets: new Map([
        ['w', { side: 'w', members: [queen] }],
        ['b', { side: 'b', members: [] }],
      ]),
      standings: [
        { commanderId: white.id, standing: 0, cohortExternality: 0 },
        { commanderId: black.id, standing: 0, cohortExternality: 0 },
      ],
      registers: new Map(),
      previousPurses: new Map(),
      config: {
        ...SEMINAR_CONFIG,
        DRAFT_CONSULTATIONS_PER_CYCLE: 0,
        DRAFT_LOT_BASE_PRICE: 1,
        DRAFT_LOT_ROLE_WEIGHT_PERMILLE: 1000,
      },
    });
    expect(result.observation.declinedLots).toBe(1);
    expect(result.observation.clearedLots).toBe(0);
    expect(result.markets.get('w')?.members).toHaveLength(1);
  });

  it('counts only bidders who meet candidate acceptance as contested', () => {
    const aggressive = createCommanderPool({
      id: 'w:commander:00',
      side: 'w',
      style: 'tyrannical',
      careerSeed: 63,
    });
    const cautious = createCommanderPool({
      id: 'w:commander:01',
      side: 'w',
      style: 'servant',
      careerSeed: 64,
    });
    const black = createCommanderPool({
      id: 'b:commander:00',
      side: 'b',
      style: 'servant',
      careerSeed: 65,
    });
    const aggressiveWithoutQueen = {
      ...aggressive,
      members: aggressive.members.filter(
        (member) => member.originRole !== 'Queen',
      ),
    };
    const cautiousWithoutQueen = {
      ...cautious,
      members: cautious.members.filter(
        (member) => member.originRole !== 'Queen',
      ),
    };
    const pools = new Map<string, CommanderPool>([
      [aggressive.id, aggressiveWithoutQueen],
      [cautious.id, cautiousWithoutQueen],
      [black.id, black],
    ]);
    const market = createSeminarMarkets(63, pools);
    const queen = market
      .get('w')
      ?.members.find((member) => member.originRole === 'Queen');
    if (queen === undefined) throw new Error('Missing queen candidate.');
    const candidate = {
      ...queen,
      state: {
        ...queen.state,
        credence: { ...queen.state.credence, tauBenev: 100 },
      },
      credenceIdentity: {
        ...queen.credenceIdentity,
        relationshipAccounts: {
          ...(queen.credenceIdentity?.relationshipAccounts ?? {}),
          [aggressive.id]: {
            tauAbil: 50,
            tauBenev: 100,
            abilityObservationCount: 0,
          },
        },
      },
    };
    const result = runSeminarDraft({
      cycle: 2,
      seed: 63,
      commanders: [
        { id: aggressive.id, side: 'w', style: 'tyrannical' },
        { id: cautious.id, side: 'w', style: 'servant' },
        { id: black.id, side: 'b', style: 'servant' },
      ],
      pools,
      markets: new Map([
        ['w', { side: 'w', members: [candidate] }],
        ['b', { side: 'b', members: [] }],
      ]),
      standings: [
        { commanderId: aggressive.id, standing: 0, cohortExternality: 0 },
        { commanderId: cautious.id, standing: 0, cohortExternality: 0 },
        { commanderId: black.id, standing: 0, cohortExternality: 0 },
      ],
      registers: new Map(),
      previousPurses: new Map(),
      config: {
        ...SEMINAR_CONFIG,
        DRAFT_CONSULTATIONS_PER_CYCLE: 0,
        DRAFT_LOT_BASE_PRICE: 10,
        DRAFT_LOT_ROLE_WEIGHT_PERMILLE: 0,
      },
    });
    expect(result.observation.contestedLots).toBe(0);
    expect(result.observation.clearedLots).toBe(1);
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
    const deeper = createSeminarMarkets(7, pools, {
      ...SEMINAR_CONFIG,
      DRAFT_MARKET_DEPTH_PER_SIDE: 20,
    });
    expect(deeper.get('w')?.members.length).toBeGreaterThan(
      initialWhiteMarket.members.length,
    );
    const trusted = createSeminarMarkets(7, pools, {
      ...SEMINAR_CONFIG,
      DRAFT_MARKET_INITIAL_TRUST: 80,
    });
    const trustedQueen = trusted
      .get('w')
      ?.members.find((member) => member.originRole === 'Queen');
    expect(trustedQueen?.state.T_i).toBe(80);
    if (marketQueen === undefined) throw new Error('Missing queen.');
    expect(
      publicLotBasePrice(marketQueen, {
        ...SEMINAR_CONFIG,
        DRAFT_LOT_BASE_PRICE: 7,
      }),
    ).not.toBe(publicLotBasePrice(marketQueen, SEMINAR_CONFIG));
    expect(
      publicLotBasePrice(marketQueen, {
        ...SEMINAR_CONFIG,
        DRAFT_LOT_ROLE_WEIGHT_PERMILLE: 1000,
      }),
    ).not.toBe(publicLotBasePrice(marketQueen, SEMINAR_CONFIG));
    const experienced = {
      ...marketQueen,
      service: { ...marketQueen.service, captures: 10 },
    };
    const noServiceWeight = publicLotBasePrice(experienced, {
      ...SEMINAR_CONFIG,
      DRAFT_LOT_SERVICE_WEIGHT_PERMILLE: 0,
    });
    const fullServiceWeight = publicLotBasePrice(experienced, {
      ...SEMINAR_CONFIG,
      DRAFT_LOT_SERVICE_WEIGHT_PERMILLE: 10000,
    });
    expect(fullServiceWeight).toBeGreaterThan(noServiceWeight);
    expect(publicLotBasePrice(experienced, SEMINAR_CONFIG)).toBeGreaterThan(
      noServiceWeight,
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
        DRAFT_LOT_BASE_PRICE: 2,
        DRAFT_LOT_ROLE_WEIGHT_PERMILLE: 0,
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
    expect(noCounsel.counselSelections.length).toBeGreaterThan(0);
    expect(
      noCounsel.counselSelections.some((selection) => selection.counsel !== 0),
    ).toBe(true);
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
