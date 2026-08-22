import { describe, expect, it } from 'vitest';

import {
  applyLevyStandingCost,
  fieldSquad,
  identityCreationSeed,
  poolRoleCountsForReserveDepth,
  reserveDepthForConfig,
  stateForLevy,
  type HeadlessMatchResult,
  type SquadFieldingPool,
  type SquadMember,
} from '../src/orchestration';
import {
  applyCaptureInjury,
  defaultCredence,
  defaultRumor,
  type MatchEvent,
  type PieceState,
} from '../src/psychology';
import { SEASON_CONFIG } from '../sim/seasonConfig';
import {
  createCommanderPool,
  fieldPool,
  foldMatchIntoPools,
  poolSnapshot,
  poolSeasonMetrics,
  poolRoleCounts,
  type CommanderPool,
} from '../sim/pool';
import { runSeason } from '../sim/season';
import { detectPoolDegeneracy } from '../sim/degeneracy';

function emptyResult(
  roster: readonly PieceState[],
  enemyRoster: readonly PieceState[],
  events: readonly MatchEvent[] = [],
  departedRoster: readonly PieceState[] = [],
  departedEnemyRoster: readonly PieceState[] = [],
): HeadlessMatchResult {
  return {
    events,
    roster,
    departedRoster,
    enemyRoster,
    departedEnemyRoster,
    enemyFieldedPieceIds: enemyRoster.map((piece) => piece.id),
    plies: 1,
    winScore: 0,
    rout: false,
    enemyRout: false,
    refusedGoodMoves: 0,
    winningPositionDesertions: 0,
    justifiedRefusalObviousness: [],
    justifiedRefusalPrivateViewLosses: [],
    determinismId: 'test',
    enemyObservableBehaviours: [],
  };
}

function withMembers(
  pool: CommanderPool,
  members: CommanderPool['members'],
): CommanderPool {
  return { ...pool, members };
}

describe('scarce season pools', () => {
  it('apportions a reserve across non-King roles by largest remainder', () => {
    const depths = [0, 7, 15, 30];
    const totals = depths.map((depth) =>
      Object.values(poolRoleCountsForReserveDepth(depth)).reduce(
        (sum, count) => sum + count,
        0,
      ),
    );
    expect(totals).toEqual([16, 23, 31, 46]);
    expect(poolRoleCountsForReserveDepth(15)).toMatchObject({
      King: 1,
      Queen: 2,
      Rook: 4,
      Bishop: 4,
      Knight: 4,
      Pawn: 16,
    });
    expect(poolRoleCountsForReserveDepth(7).Pawn).toBeGreaterThan(
      poolRoleCountsForReserveDepth(7).Queen,
    );
    expect(
      reserveDepthForConfig({
        ...SEASON_CONFIG,
        POOL_DEPTH_FACTOR: 3,
        RESERVE_DEPTH: 0,
      }),
    ).toBe(30);
  });

  it('keeps the cycle-one levy detector quiet by default and trips on thin stock', () => {
    const defaultPool = createCommanderPool({
      id: 'default',
      side: 'w',
      style: 'servant',
    });
    expect(fieldPool(defaultPool, 1).conscriptsFielded).toBe(0);
    expect(fieldPool(defaultPool, 1).chargedMembers).toBeUndefined();
    const thinPool = createCommanderPool({
      id: 'thin',
      side: 'w',
      style: 'servant',
      reserveDepth: 0,
    });
    const depleted = withMembers(
      thinPool,
      thinPool.members.map((member) =>
        member.state.role === 'Pawn'
          ? { ...member, status: 'retired' as const }
          : member,
      ),
    );
    const fielded = fieldPool(depleted, 1);
    expect(fielded.conscriptsFielded).toBeGreaterThan(0);
    const metrics = poolSeasonMetrics({
      initialPool: depleted,
      finalPool: depleted,
      lineups: [fielded.lineup.map((member) => member.state.id)],
      promotionMatches: new Map(),
      firstCycleLevies: fielded.conscriptsFielded,
    });
    expect(
      detectPoolDegeneracy(metrics).some(
        (finding) => finding.code === 'cycle-one-unplayability',
      ),
    ).toBe(true);
  });

  it('probes each levy inheritance and standing-cost control', () => {
    const source = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'supportive',
      depthFactor: 1,
      config: {
        ...SEASON_CONFIG,
        LEVY_INHERITED_TRUST_PERMILLE: 1000,
        LEVY_INHERITED_CREDENCE_PERMILLE: 1000,
      },
    });
    const retiredPawns = source.members
      .filter((member) => member.state.role === 'Pawn')
      .map((member) => member.state.id);
    const tuned = withMembers(
      source,
      source.members.map((member) => ({
        ...member,
        status: retiredPawns.includes(member.state.id)
          ? ('retired' as const)
          : member.status,
        state: {
          ...member.state,
          T_i: 80,
          credence: {
            ...member.state.credence,
            tauAbil: 20,
            tauBenev: 80,
            abilityObservationCount: 12,
          },
        },
      })),
    );
    const levies = [0, 500, 1000].map((weight) =>
      fieldPool(
        {
          ...tuned,
          config: {
            ...SEASON_CONFIG,
            LEVY_INHERITED_TRUST_PERMILLE: weight,
            LEVY_INHERITED_CREDENCE_PERMILLE: weight,
          },
        },
        1,
      ),
    );
    const conscripts = levies.map((fielded) =>
      fielded.lineup.find((member) => member.provenance === 'conscript'),
    );
    expect(conscripts.map((member) => member?.state.T_i)).toEqual([40, 60, 80]);
    expect(conscripts.map((member) => member?.state.credence.tauAbil)).toEqual([
      50, 35, 20,
    ]);
    expect(
      conscripts.map(
        (member) => member?.state.credence.abilityObservationCount,
      ),
    ).toEqual([0, 0, 0]);
    const costs = [0, 2, 5].map((cost) =>
      fieldPool(
        {
          ...tuned,
          config: { ...SEASON_CONFIG, LEVY_STANDING_COST: cost },
        },
        1,
      ),
    );
    const firstMemberId = tuned.members.find(
      (member) => member.status !== 'retired',
    )?.state.id;
    if (firstMemberId === undefined) throw new Error('expected source member');
    expect(
      costs.map((fielded) => {
        const member = (fielded.chargedMembers ?? tuned.members).find(
          (candidate) => candidate.state.id === firstMemberId,
        );
        return member?.state.credence.tauBenev;
      }),
    ).toEqual([80, 64, 40]);
    expect(costs[0]?.chargedMembers).toBeUndefined();
    const baselineState = tuned.members.find(
      (member) => member.status !== 'retired',
    )?.state;
    if (baselineState === undefined) throw new Error('expected baseline state');
    expect(stateForLevy(baselineState, tuned.members, SEASON_CONFIG).T_i).toBe(
      80,
    );
    expect(
      applyLevyStandingCost(tuned.members, 0, {
        ...SEASON_CONFIG,
        LEVY_STANDING_COST: 5,
      }),
    ).toEqual(tuned.members);
  });

  it('does not count a final-match promotion as a missed return', () => {
    const pool = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'supportive',
      depthFactor: 1,
    });
    const promoted = pool.members.find(
      (member) => member.originRole === 'Pawn',
    );
    if (promoted === undefined) throw new Error('Expected a pawn member.');
    const metrics = poolSeasonMetrics({
      initialPool: pool,
      finalPool: pool,
      lineups: [[promoted.state.id], [promoted.state.id]],
      promotionMatches: new Map([[promoted.state.id, 2]]),
    });
    expect(metrics.promotions).toBe(1);
    expect(metrics.promotionsWithRemainingWindow).toBe(0);
    expect(metrics.crownedNeverFieldedAgain).toBe(0);

    const noReturn = poolSeasonMetrics({
      initialPool: pool,
      finalPool: pool,
      lineups: [[promoted.state.id], []],
      promotionMatches: new Map([[promoted.state.id, 1]]),
    });
    expect(noReturn.promotionsWithRemainingWindow).toBe(1);
    expect(noReturn.crownedNeverFieldedAgain).toBe(1);
  });

  it('scales role depth while keeping exactly one King', () => {
    const pool = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'supportive',
      depthFactor: 2,
    });
    const counts = poolRoleCounts();
    for (const [role, count] of Object.entries(counts)) {
      expect(
        pool.members.filter((member) => member.state.role === role),
      ).toHaveLength(role === 'King' ? 1 : count * 2);
    }
    expect(
      pool.members.filter((member) => member.state.role === 'King'),
    ).toHaveLength(1);
    expect(
      pool.members.every((member) => member.state.id.startsWith('w:')),
    ).toBe(true);
    expect(
      fieldPool(pool, 1).lineup.filter(
        (member) => member.state.role === 'King',
      ),
    ).toHaveLength(1);
  });

  it('uses named deterministic fielding policies and stable ID ties', () => {
    const base = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'supportive',
      depthFactor: 2,
    });
    const pawns = base.members.filter((member) => member.state.role === 'Pawn');
    const adjusted = base.members.map((member) => {
      if (member.state.id === pawns[0]?.state.id) {
        return {
          ...member,
          state: { ...member.state, E_i: 99, B_i: 90 },
        };
      }
      if (member.state.id === pawns[1]?.state.id) {
        return {
          ...member,
          state: { ...member.state, E_i: 1, B_i: 0 },
        };
      }
      return member;
    });
    const strongest = fieldPool(
      withMembers({ ...base, fieldingPolicy: 'strongest_available' }, adjusted),
      1,
    );
    const rested = fieldPool(
      withMembers({ ...base, fieldingPolicy: 'rest_traumatised' }, adjusted),
      1,
    );
    const strongestPawnIds = strongest.lineup
      .filter((member) => member.state.role === 'Pawn')
      .map((member) => member.state.id);
    const restedPawnIds = rested.lineup
      .filter((member) => member.state.role === 'Pawn')
      .map((member) => member.state.id);
    expect(strongestPawnIds).not.toEqual(restedPawnIds);
    expect(restedPawnIds).toEqual([...restedPawnIds].sort());
  });

  it('ranks a persisted promoted pawn by ability relative to origin role', () => {
    const base = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'tyrannical',
      depthFactor: 1,
    });
    const pawn = base.members.find((member) => member.state.role === 'Pawn');
    const queen = base.members.find((member) => member.state.role === 'Queen');
    if (pawn === undefined || queen === undefined) {
      throw new Error('Expected a pawn and queen in the initial pool.');
    }
    const promoted = {
      ...pawn,
      attainedRole: 'Queen' as const,
      state: { ...pawn.state, role: 'Pawn' as const, E_i: 40 },
    };
    const pool = withMembers(
      base,
      base.members.map((member) =>
        member.state.id === pawn.state.id
          ? promoted
          : member.state.id === queen.state.id
            ? { ...member, state: { ...member.state, E_i: 55 } }
            : member,
      ),
    );
    const fielded = fieldPool(pool, 1);
    const selectedQueen = fielded.lineup.find(
      (member) => member.state.role === 'Queen',
    );
    expect(selectedQueen?.state.id).toBe(pawn.state.id);
    expect(
      fielded.lineup.filter((member) => member.state.id === pawn.state.id),
    ).toHaveLength(1);
    expect(selectedQueen?.state.role).toBe('Queen');
  });

  it('falls a crowned member back to her origin chair after losing the crown chair', () => {
    const base = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'tyrannical',
      depthFactor: 1,
    });
    const pawn = base.members.find((member) => member.originRole === 'Pawn');
    const queen = base.members.find((member) => member.originRole === 'Queen');
    if (pawn === undefined || queen === undefined) {
      throw new Error('Expected a pawn and queen.');
    }
    const pool = withMembers(
      base,
      base.members.map((member) =>
        member.state.id === pawn.state.id
          ? {
              ...member,
              attainedRole: 'Queen' as const,
              state: { ...member.state, E_i: 1 },
            }
          : member.state.id === queen.state.id
            ? { ...member, state: { ...member.state, E_i: 99 } }
            : member,
      ),
    );
    const fielded = fieldPool(pool, 1);
    const pawnChairs = fielded.lineup.filter(
      (member) => member.state.id === pawn.state.id,
    );
    expect(pawnChairs).toHaveLength(1);
    expect(pawnChairs[0]?.state.role).toBe('Pawn');
    expect(
      fielded.lineup.filter((member) => member.state.role === 'King'),
    ).toHaveLength(1);
  });

  it('fills chairs highest-first before origin fallback', () => {
    const base = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'tyrannical',
      depthFactor: 1,
    });
    const pawn = base.members.find((member) => member.originRole === 'Pawn');
    const queen = base.members.find((member) => member.originRole === 'Queen');
    if (pawn === undefined || queen === undefined) {
      throw new Error('Expected a pawn and queen.');
    }
    const pool = withMembers(
      base,
      base.members.map((member) =>
        member.state.id === pawn.state.id
          ? {
              ...member,
              attainedRole: 'Queen' as const,
              state: { ...member.state, E_i: 99 },
            }
          : member.state.id === queen.state.id
            ? { ...member, state: { ...member.state, E_i: 1 } }
            : member,
      ),
    );
    const fielded = fieldPool(pool, 1);
    expect(
      fielded.lineup.find((member) => member.state.id === pawn.state.id)?.state
        .role,
    ).toBe('Queen');
  });

  it('exposes shipped fielding to non-sim callers', (): void => {
    const makeMember = (
      id: string,
      role: PieceState['role'],
      attainedRole?: PieceState['role'],
    ): SquadMember => ({
      state: {
        id,
        role,
        traits: {
          w_honor: 0.5,
          w_courage: 0.5,
          w_ambition: 0.5,
          w_loyalty: 0.5,
          w_empathy: 0.5,
          w_prestige: 0.5,
        },
        E_i: 50,
        T_i: 50,
        M_i: 50,
        B_i: 0,
        dyadicAffinity: {},
        classPrestige: {
          Pawn: 0,
          Knight: 0,
          Bishop: 0,
          Rook: 0,
          Queen: 0,
          King: 0,
        },
        engagementFactor: 1,
        credence: defaultCredence(),
        rumor: defaultRumor(),
      },
      originRole: role,
      ...(attainedRole === undefined ? {} : { attainedRole }),
      status: 'available',
      availableAtMatch: 1,
      provenance: 'original',
      service: {
        matchesPlayed: 0,
        desertions: 0,
        refusals: 0,
        captures: 0,
        consecutiveNonSelections: 0,
      },
    });
    const pawn = makeMember('pawn', 'Pawn', 'Queen');
    const pool: SquadFieldingPool = {
      members: [makeMember('king', 'King'), pawn],
      fieldingPolicy: 'strongest_available',
    };
    const fielded = fieldSquad(
      pool,
      1,
      (role, match, sequence): SquadMember => ({
        ...makeMember(`conscript:${role}:${String(sequence)}`, role),
        availableAtMatch: match,
        provenance: 'conscript',
      }),
    );
    expect(
      fielded.lineup.find((member) => member.state.id === pawn.state.id)?.state
        .role,
    ).toBe('Queen');
  });

  it('has a golden baseline and sensitivity for pool depth', () => {
    const baseline = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'servant',
      depthFactor: SEASON_CONFIG.POOL_DEPTH_FACTOR,
    });
    const shallow = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'servant',
      depthFactor: 1,
    });
    expect(baseline.members).toHaveLength(31);
    expect(shallow.members).not.toHaveLength(baseline.members.length);
    const pawnTraits = baseline.members
      .filter((member) => member.state.role === 'Pawn')
      .map((member) => member.state.traits);
    expect(
      new Set(pawnTraits.map((traits) => JSON.stringify(traits))).size,
    ).toBeGreaterThan(1);
    expect(poolSnapshot(baseline, fieldPool(baseline, 1)).total).toBe(31);
  });

  it('threads the season seed into identity creation', () => {
    const first = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'servant',
      careerSeed: 7,
    });
    const second = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'servant',
      careerSeed: 8,
    });
    const firstMember = first.members[0];
    const secondMember = second.members[0];
    if (firstMember === undefined || secondMember === undefined) {
      throw new Error('expected initial pool members');
    }
    expect(firstMember.credenceIdentity?.identityCreationSeed).toBe(
      identityCreationSeed(7, firstMember.state.id),
    );
    expect(secondMember.credenceIdentity?.identityCreationSeed).toBe(
      identityCreationSeed(8, secondMember.state.id),
    );
    expect(firstMember.credenceIdentity?.identityCreationSeed).not.toBe(
      secondMember.credenceIdentity?.identityCreationSeed,
    );
  });

  it('threads the pool-depth config through season output', async () => {
    const baseline = await runSeason({
      seed: 7,
      matches: 1,
      whiteStyle: 'servant',
      blackStyle: 'supportive',
      engineKind: 'fake',
    });
    const shallow = await runSeason({
      seed: 7,
      matches: 1,
      whiteStyle: 'servant',
      blackStyle: 'supportive',
      engineKind: 'fake',
      config: { ...SEASON_CONFIG, POOL_DEPTH_FACTOR: 1 },
    });
    expect(JSON.stringify(shallow)).not.toBe(JSON.stringify(baseline));
  }, 30_000);

  it('replays a season byte-for-byte and emits raw metrics without a scorecard', async () => {
    const options = {
      seed: 42,
      matches: 2,
      whiteStyle: 'supportive' as const,
      blackStyle: 'servant' as const,
      engineKind: 'fake' as const,
    };
    const first = await runSeason(options);
    const second = await runSeason(options);
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
    expect(first.metrics).toHaveLength(2);
    expect(first.horizon).toHaveLength(2);
    expect('aggregateSeasonScore' in first).toBe(false);
    expect(first.whiteSnapshots[0]).toMatchObject({
      available: expect.any(Number),
      total: 31,
      recovering: expect.any(Number),
      retired: expect.any(Number),
      conscriptsFielded: 0,
      veteransRested: expect.any(Number),
    });
  }, 30_000);

  it('conscripts role shortfalls and transfers the pool appraisal', () => {
    const pool = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'supportive',
      depthFactor: 1,
    });
    const firstPawn = pool.members.find(
      (member) => member.state.role === 'Pawn',
    );
    if (firstPawn === undefined) throw new Error('expected pawn');
    const trustedOfficer = pool.members.find(
      (member) => member.state.role === 'Rook',
    );
    if (trustedOfficer === undefined) throw new Error('expected rook');
    const depleted = withMembers(
      pool,
      pool.members.map((member) =>
        member.state.role === 'Pawn'
          ? { ...member, status: 'retired' as const }
          : {
              ...member,
              state: {
                ...member.state,
                credence: {
                  ...member.state.credence,
                  tauAbil: 12,
                  tauBenev: 88,
                },
              },
            },
      ),
    );
    const fielded = fieldPool(depleted, 1);
    const conscript = fielded.lineup.find(
      (member) => member.provenance === 'conscript',
    );
    expect(conscript?.state.id).toContain(':conscript:1:');
    expect(conscript?.state.credence.tauAbil).toBe(12);
    expect(conscript?.state.credence.tauBenev).toBe(88);
    expect(conscript?.state.T_i).toBe(40);
    expect(conscript?.state.M_i).toBe(70);
    expect(conscript?.state.B_i).toBe(0);
    expect(conscript?.state.dyadicAffinity).toEqual({});
    expect(conscript?.state.rumor).toEqual(firstPawn.state.rumor);
    expect(conscript?.state.traits).not.toEqual(firstPawn.state.traits);
    expect(conscript?.state.credence.tauAbil).not.toBe(
      firstPawn.state.credence.tauAbil,
    );
    expect(trustedOfficer.state.credence.tauAbil).toBe(50);
  });

  it('keeps a deserter absent for exactly K matches and retires permanently', () => {
    const white = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'servant',
      depthFactor: 2,
    });
    const black = createCommanderPool({
      id: 'b',
      side: 'b',
      style: 'servant',
      depthFactor: 2,
    });
    const fielded = fieldPool(white, 1);
    const target = fielded.lineup.find(
      (member) => member.state.role === 'Pawn',
    );
    if (target === undefined) throw new Error('expected pawn');
    const desertion: Extract<MatchEvent, { t: 'DESERTION' }> = {
      t: 'DESERTION',
      ply: 1,
      pieceId: target.state.id,
      refusedMove: 'a2a3',
      uStay: 0,
      uDesert: 1,
      departureKind: 'first',
    };
    const result = emptyResult(
      fielded.lineup
        .map((member) => member.state)
        .filter((state) => state.id !== target.state.id),
      fieldPool(black, 1).lineup.map((member) => member.state),
      [desertion],
      [{ ...target.state, B_i: 33 }],
    );
    const folded = foldMatchIntoPools({
      white,
      black,
      whiteFielded: fielded,
      blackFielded: fieldPool(black, 1),
      result,
      match: 1,
    });
    const recovering = folded.white.members.find(
      (member) => member.state.id === target.state.id,
    );
    expect(recovering?.status).toBe('recovering');
    expect(fieldPool(folded.white, 2).lineup).not.toContainEqual(recovering);
    expect(fieldPool(folded.white, 3).lineup).not.toContainEqual(recovering);
    const returned = folded.white.members.find(
      (member) => member.state.id === target.state.id,
    );
    expect(returned?.status).toBe('recovering');
    expect(returned?.availableAtMatch).toBe(4);
    expect(returned?.state.B_i).toBe(33);
    const shortAbsence = foldMatchIntoPools({
      white,
      black,
      whiteFielded: fielded,
      blackFielded: fieldPool(black, 1),
      result,
      match: 1,
      config: { ...SEASON_CONFIG, DESERTION_ABSENCE_MATCHES: 1 },
    }).white.members.find((member) => member.state.id === target.state.id);
    expect(shortAbsence?.availableAtMatch).toBe(3);

    const captured = foldMatchIntoPools({
      white,
      black,
      whiteFielded: fielded,
      blackFielded: fieldPool(black, 1),
      result: emptyResult(
        fielded.lineup
          .map((member) => member.state)
          .filter((state) => state.id !== target.state.id),
        fieldPool(black, 1).lineup.map((member) => member.state),
        [],
        [applyCaptureInjury({ ...target.state, B_i: 44 })],
      ),
      match: 1,
    }).white.members.find((member) => member.state.id === target.state.id);
    expect(captured?.service.captures).toBe(1);
    expect(captured?.state.B_i).toBe(64);
    expect(captured?.status).toBe('available');
    expect(captured?.availableAtMatch).toBe(2);

    const retiredState = {
      ...target.state,
      B_i: SEASON_CONFIG.RETIREMENT_TRAUMA_THRESHOLD,
    };
    const retirementResult = emptyResult(
      fielded.lineup.map((member) =>
        member.state.id === target.state.id ? retiredState : member.state,
      ),
      fieldPool(black, 1).lineup.map((member) => member.state),
    );
    const retired = foldMatchIntoPools({
      white,
      black,
      whiteFielded: fielded,
      blackFielded: fieldPool(black, 1),
      result: retirementResult,
      match: 1,
    }).white;
    const retiredMember = retired.members.find(
      (member) => member.state.id === target.state.id,
    );
    expect(retiredMember?.status).toBe('retired');
    expect(fieldPool(retired, 2).lineup).not.toContainEqual(retiredMember);
    const lowerThreshold = foldMatchIntoPools({
      white,
      black,
      whiteFielded: fielded,
      blackFielded: fieldPool(black, 1),
      result: retirementResult,
      match: 1,
      config: { ...SEASON_CONFIG, RETIREMENT_TRAUMA_THRESHOLD: 1 },
    }).white.members.find((member) => member.state.id === target.state.id);
    expect(lowerThreshold?.status).toBe('retired');

    const king = fielded.lineup.find((member) => member.state.role === 'King');
    if (king === undefined) throw new Error('expected king');
    const kingResult = emptyResult(
      fielded.lineup.map((member) =>
        member.state.id === king.state.id
          ? { ...member.state, B_i: Number.MAX_SAFE_INTEGER }
          : member.state,
      ),
      fieldPool(black, 1).lineup.map((member) => member.state),
    );
    const kingAfterTrauma = foldMatchIntoPools({
      white,
      black,
      whiteFielded: fielded,
      blackFielded: fieldPool(black, 1),
      result: kingResult,
      match: 1,
    }).white.members.find((member) => member.state.id === king.state.id);
    expect(kingAfterTrauma?.status).toBe('available');
    expect(fieldPool(folded.white, 2).lineup).toContainEqual(
      expect.objectContaining({
        state: expect.objectContaining({ role: 'King' }),
      }),
    );
  });

  it('counts only available non-selection, erodes trust, and redeems selection', () => {
    const white = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'servant',
      depthFactor: 2,
    });
    const black = createCommanderPool({
      id: 'b',
      side: 'b',
      style: 'servant',
      depthFactor: 2,
    });
    const initialFielded = fieldPool(white, 1);
    const target = white.members.find(
      (member) =>
        member.state.role === 'Pawn' &&
        !initialFielded.lineup.some(
          (fieldedMember) => fieldedMember.state.id === member.state.id,
        ),
    );
    if (target === undefined) throw new Error('expected an unselected pawn');
    const selected = initialFielded.lineup.filter(
      (member) => member.state.id !== target.state.id,
    );
    const fielded = { ...initialFielded, lineup: selected };
    const blackFielded = fieldPool(black, 1);
    const result = emptyResult(
      selected.map((member) => member.state),
      blackFielded.lineup.map((member) => member.state),
    );
    const first = foldMatchIntoPools({
      white,
      black,
      whiteFielded: fielded,
      blackFielded,
      result,
      match: 1,
    });
    const targetAfterFirst = first.white.members.find(
      (member) => member.state.id === target.state.id,
    );
    expect(targetAfterFirst?.service.consecutiveNonSelections).toBe(1);
    expect(targetAfterFirst?.state.T_i).toBe(target.state.T_i);

    const secondFielded = fieldPool(first.white, 2);
    const secondSelected = secondFielded.lineup.filter(
      (member) => member.state.id !== target.state.id,
    );
    const second = foldMatchIntoPools({
      white: first.white,
      black: first.black,
      whiteFielded: { ...secondFielded, lineup: secondSelected },
      blackFielded: fieldPool(first.black, 2),
      result: emptyResult(
        secondSelected.map((member) => member.state),
        fieldPool(first.black, 2).lineup.map((member) => member.state),
      ),
      match: 2,
    });
    const targetAfterSecond = second.white.members.find(
      (member) => member.state.id === target.state.id,
    );
    expect(targetAfterSecond?.service.consecutiveNonSelections).toBe(2);
    expect(targetAfterSecond?.state.T_i).toBe(
      target.state.T_i + SEASON_CONFIG.NON_SELECTION_SELF_TRUST_PENALTY,
    );
    expect(
      second.events.find(
        (event) =>
          event.t === 'POOL_TRUST_ADJUSTMENT' &&
          event.reason === 'non_selection' &&
          event.pieceId === target.state.id,
      ),
    ).toMatchObject({
      selfTrustDelta: SEASON_CONFIG.NON_SELECTION_SELF_TRUST_PENALTY,
    });

    const thirdFielded = fieldPool(second.white, 3);
    const replacement = thirdFielded.lineup.find(
      (member) => member.state.role === target.state.role,
    );
    if (replacement === undefined) throw new Error('expected replacement');
    const thirdLineup = [
      ...thirdFielded.lineup.filter(
        (member) => member.state.id !== replacement.state.id,
      ),
      targetAfterSecond ?? target,
    ];
    const third = foldMatchIntoPools({
      white: second.white,
      black: second.black,
      whiteFielded: { ...thirdFielded, lineup: thirdLineup },
      blackFielded: fieldPool(second.black, 3),
      result: emptyResult(
        thirdLineup.map((member) => member.state),
        fieldPool(second.black, 3).lineup.map((member) => member.state),
      ),
      match: 3,
    });
    const redeemed = third.white.members.find(
      (member) => member.state.id === target.state.id,
    );
    expect(redeemed?.service.consecutiveNonSelections).toBe(0);
    expect(redeemed?.state.T_i).toBe(
      target.state.T_i +
        SEASON_CONFIG.NON_SELECTION_SELF_TRUST_PENALTY +
        SEASON_CONFIG.NON_SELECTION_REDEMPTION_TRUST_RECOVERY,
    );
    expect(
      Math.abs(SEASON_CONFIG.NON_SELECTION_REDEMPTION_TRUST_RECOVERY),
    ).toBeLessThan(Math.abs(SEASON_CONFIG.NON_SELECTION_SELF_TRUST_PENALTY));
  });

  it('records obsolescence separately from trauma retirement', () => {
    const white = createCommanderPool({
      id: 'w',
      side: 'w',
      style: 'servant',
      depthFactor: 2,
    });
    const black = createCommanderPool({
      id: 'b',
      side: 'b',
      style: 'servant',
      depthFactor: 2,
    });
    const fielded = fieldPool(white, 1);
    const target = white.members.find(
      (member) =>
        member.state.role === 'Pawn' &&
        !fielded.lineup.some(
          (candidate) => candidate.state.id === member.state.id,
        ),
    );
    if (target === undefined) throw new Error('expected an unselected pawn');
    let current = white;
    let events: ReturnType<typeof foldMatchIntoPools>['events'] = [];
    for (let match = 1; match <= 3; match += 1) {
      const available = fieldPool(current, match);
      const lineup = available.lineup.filter(
        (member) => member.state.id !== target.state.id,
      );
      const folded = foldMatchIntoPools({
        white: current,
        black,
        whiteFielded: { ...available, lineup },
        blackFielded: fieldPool(black, match),
        result: emptyResult(
          lineup.map((member) => member.state),
          fieldPool(black, match).lineup.map((member) => member.state),
        ),
        match,
        config: {
          ...SEASON_CONFIG,
          OBSOLESCENCE_NON_SELECTION_THRESHOLD: 3,
        },
      });
      current = folded.white;
      events = folded.events;
    }
    const obsolete = current.members.find(
      (member) => member.state.id === target.state.id,
    );
    expect(obsolete?.status).toBe('retired');
    expect(obsolete?.retirementCause).toBe('obsolescence');
    expect(
      events.find(
        (event) =>
          event.t === 'OBSOLESCENCE' && event.pieceId === target.state.id,
      ),
    ).toMatchObject({ nonSelectionStreak: 3 });
    expect(poolSnapshot(current, fieldPool(current, 4)).obsolescenceCount).toBe(
      1,
    );
  });

  it('has golden and sensitivity coverage for selection knobs', async () => {
    const config = SEASON_CONFIG;
    expect(config.NON_SELECTION_TRUST_THRESHOLD).toBe(2);
    expect(config.NON_SELECTION_SELF_TRUST_PENALTY).toBe(-10);
    expect(config.NON_SELECTION_PEER_TRUST_PENALTY).toBe(-2);
    expect(config.NON_SELECTION_REDEMPTION_TRUST_RECOVERY).toBe(4);
    expect(config.OBSOLESCENCE_NON_SELECTION_THRESHOLD).toBe(6);

    const baseline = await runSeason({
      seed: 1,
      matches: 4,
      whiteStyle: 'tyrannical',
      blackStyle: 'supportive',
      depthFactor: 3,
      engineKind: 'fake',
    });
    expect(
      baseline.poolEvents.some(
        (event) =>
          event.t === 'POOL_TRUST_ADJUSTMENT' &&
          event.reason === 'selection_redemption',
      ),
    ).toBe(true);
    const changedThreshold = await runSeason({
      seed: 1,
      matches: 4,
      whiteStyle: 'tyrannical',
      blackStyle: 'supportive',
      depthFactor: 3,
      engineKind: 'fake',
      config: { ...config, NON_SELECTION_TRUST_THRESHOLD: 1 },
    });
    const changedSelfPenalty = await runSeason({
      seed: 1,
      matches: 4,
      whiteStyle: 'tyrannical',
      blackStyle: 'supportive',
      depthFactor: 3,
      engineKind: 'fake',
      config: { ...config, NON_SELECTION_SELF_TRUST_PENALTY: -20 },
    });
    const changedPeerPenalty = await runSeason({
      seed: 1,
      matches: 4,
      whiteStyle: 'tyrannical',
      blackStyle: 'supportive',
      depthFactor: 3,
      engineKind: 'fake',
      config: { ...config, NON_SELECTION_PEER_TRUST_PENALTY: -8 },
    });
    const changedRecovery = await runSeason({
      seed: 1,
      matches: 4,
      whiteStyle: 'tyrannical',
      blackStyle: 'supportive',
      depthFactor: 3,
      engineKind: 'fake',
      config: { ...config, NON_SELECTION_REDEMPTION_TRUST_RECOVERY: 1 },
    });
    const changedObsolescence = await runSeason({
      seed: 1,
      matches: 4,
      whiteStyle: 'tyrannical',
      blackStyle: 'supportive',
      depthFactor: 3,
      engineKind: 'fake',
      config: { ...config, OBSOLESCENCE_NON_SELECTION_THRESHOLD: 2 },
    });
    expect(JSON.stringify(changedThreshold)).not.toBe(JSON.stringify(baseline));
    expect(JSON.stringify(changedSelfPenalty)).not.toBe(
      JSON.stringify(baseline),
    );
    expect(JSON.stringify(changedPeerPenalty)).not.toBe(
      JSON.stringify(baseline),
    );
    expect(JSON.stringify(changedRecovery)).not.toBe(JSON.stringify(baseline));
    expect(JSON.stringify(changedObsolescence)).not.toBe(
      JSON.stringify(baseline),
    );
  }, 120_000);
});
