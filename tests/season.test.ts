import { describe, expect, it } from 'vitest';

import type { HeadlessMatchResult } from '../src/orchestration';
import {
  applyCaptureInjury,
  type MatchEvent,
  type PieceState,
} from '../src/psychology';
import { SEASON_CONFIG } from '../sim/seasonConfig';
import {
  createCommanderPool,
  fieldPool,
  foldMatchIntoPools,
  poolSnapshot,
  poolRoleCounts,
  type CommanderPool,
} from '../sim/pool';
import { runSeason } from '../sim/season';

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
        pool.members.filter((member) => member.state.role === role).length,
      ).toBe(role === 'King' ? 1 : count * 2);
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
});
