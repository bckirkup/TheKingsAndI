import { describe, expect, it } from 'vitest';

import {
  applyAweShift,
  applyPanicCollapse,
  calculateEngineSearchDepth,
  calculateGriefSearchDepth,
  defaultCredence,
  defaultRumor,
  ENGINE_CONFIG,
  evaluateMoveResponse,
  normalizePieceState,
  prideAppraisalSum,
  shouldDesert,
  withoutPanic,
  type CandidateMoveEvaluation,
  type DesertionContext,
  type PieceState,
} from '../src/psychology';
import { applyMorningLift } from '../src/psychology/morningLift';
import { decayPanic } from '../src/psychology/panic';
import { foldPride } from '../sim/pride';
import { applyLivePride, runSeminar } from '../sim/seminar';
import { SEMINAR_CONFIG } from '../sim/seminarConfig';

const traits = {
  w_honor: 0.5,
  w_courage: 0.5,
  w_ambition: 0.5,
  w_loyalty: 0.5,
  w_empathy: 0.5,
  w_prestige: 0.5,
} as const;

function piece(overrides: Partial<PieceState> = {}): PieceState {
  return normalizePieceState({
    id: 'w:N:g1',
    role: 'Knight',
    traits,
    E_i: 80,
    T_i: 50,
    M_i: 80,
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
    ...overrides,
  });
}

function moveEval(
  overrides: Partial<CandidateMoveEvaluation> = {},
): CandidateMoveEvaluation {
  return {
    moveNotation: 'Nf3',
    deltaV_board: 0,
    privateScoreCp: 0,
    vLeaderImplied: 0,
    deltaV_capture: 0,
    P_captured: 0.1,
    peerSafetyDeltas: {},
    promotionProspect: 0,
    ...overrides,
  };
}

function context(overrides: Partial<DesertionContext> = {}): DesertionContext {
  return {
    P_captured: 0.2,
    P_lossIfStay: 0.5,
    P_lossIfLeave: 0.5,
    pLossBoard: 0.5,
    pivotality: 0,
    shadowFactor: 1,
    promotionProspect: 0,
    ...overrides,
  };
}

function withConfig<T>(
  patch: Partial<Record<keyof typeof ENGINE_CONFIG, number>>,
  run: () => T,
): T {
  const config = ENGINE_CONFIG as unknown as Record<string, number>;
  const original = Object.fromEntries(
    Object.keys(patch).map((key) => [key, config[key]]),
  );
  try {
    Object.assign(config, patch);
    return run();
  } finally {
    Object.assign(config, original);
  }
}

async function withConfigAsync<T>(
  patch: Partial<Record<keyof typeof ENGINE_CONFIG, number>>,
  run: () => Promise<T>,
): Promise<T> {
  const config = ENGINE_CONFIG as unknown as Record<string, number>;
  const original = Object.fromEntries(
    Object.keys(patch).map((key) => [key, config[key]]),
  );
  try {
    Object.assign(config, patch);
    return await run();
  } finally {
    Object.assign(config, original);
  }
}

describe('ADR 0078 Phase C live carriers', () => {
  it('raises refusal threshold monotonically only for positive appraisal', () => {
    const actor = piece({ selfAppraisal: 800 });
    const baseline = withConfig(
      { PRIDE_REFUSAL_SCALE: 0 },
      () => evaluateMoveResponse(actor, moveEval(), [actor]).refusalThreshold,
    );
    const mild = withConfig(
      { PRIDE_REFUSAL_SCALE: 1 },
      () => evaluateMoveResponse(actor, moveEval(), [actor]).refusalThreshold,
    );
    const strong = withConfig(
      { PRIDE_REFUSAL_SCALE: 5 },
      () => evaluateMoveResponse(actor, moveEval(), [actor]).refusalThreshold,
    );
    expect(mild).toBeGreaterThanOrEqual(baseline);
    expect(strong).toBeGreaterThanOrEqual(mild);
    const negative = withConfig(
      { PRIDE_REFUSAL_SCALE: 5 },
      () =>
        evaluateMoveResponse(piece({ selfAppraisal: -800 }), moveEval(), [
          actor,
        ]).refusalThreshold,
    );
    expect(negative).toBe(baseline);
  });

  it('reconstructs live pride appraisal with foldPride over a two-week seminar', async () => {
    const result = await withConfigAsync({ PRIDE_REFUSAL_SCALE: 1 }, () =>
      runSeminar({
        seed: 7,
        engineKind: 'fake',
        config: {
          ...SEMINAR_CONFIG,
          WEEKS_PER_SEMESTER: 2,
          MATCHES_PER_WEEK: 1,
          COMMANDERS_PER_COHORT: 2,
        },
      }),
    );
    const folded = foldPride(result.prideEvents, result.config);
    for (const [ownerId, pool] of Object.entries(result.finalPools)) {
      const careers = new Map(
        [
          ...(folded[ownerId]?.proud ?? []),
          ...(folded[ownerId]?.wounded ?? []),
        ].map((career) => [career.pieceId, career.appraisal]),
      );
      for (const member of pool.members) {
        if (!careers.has(member.state.id)) continue;
        expect(member.state.selfAppraisal).toBe(careers.get(member.state.id));
      }
    }

    const railEvents = [
      {
        cycle: 1,
        kind: 'draft' as const,
        ownerId: 'w:commander:00',
        pieceId: 'w:P:rail',
        role: 'Pawn' as const,
        price: 10_000,
      },
      {
        cycle: 2,
        kind: 'draft' as const,
        ownerId: 'w:commander:00',
        pieceId: 'w:P:rail',
        role: 'Pawn' as const,
        price: 10_000,
      },
    ];
    const rail = foldPride(railEvents, result.config);
    const ownerId = 'w:commander:00';
    const ownerPool = result.finalPools[ownerId];
    const template = ownerPool?.members[0];
    if (ownerPool === undefined || template === undefined) {
      throw new Error(`Missing test pool ${ownerId}.`);
    }
    const railPool = {
      ...ownerPool,
      members: [
        ...ownerPool.members,
        {
          ...template,
          state: {
            ...template.state,
            id: 'w:P:rail',
            role: 'Pawn' as const,
          },
        },
      ],
    };
    const live = withConfig({ PRIDE_REFUSAL_SCALE: 1 }, () =>
      applyLivePride(new Map([[ownerId, railPool]]), railEvents, result.config),
    );
    const foldedAppraisal = rail[ownerId]?.proud?.[0]?.appraisal;
    const liveAppraisal = live.get(ownerId)?.members.at(-1)
      ?.state.selfAppraisal;
    expect(foldedAppraisal).toBe(1_000);
    expect(liveAppraisal).toBe(foldedAppraisal);
    expect(prideAppraisalSum(1_000, 1_000)).toBe(1_000);
  });

  it('reduces depth monotonically with bounded panic and decays it away', () => {
    const depths = [0, 250, 500, 1_000].map((panic) =>
      calculateGriefSearchDepth(100, 1, 0, panic),
    );
    expect(depths[0]).toBeGreaterThanOrEqual(depths[1] ?? 0);
    expect(depths[1]).toBeGreaterThanOrEqual(depths[2] ?? 0);
    expect(depths[2]).toBeGreaterThanOrEqual(depths[3] ?? 0);
    expect(calculateEngineSearchDepth(100, 1, 2, 16, 0, 1_000)).toBe(1);
    const collapsed = applyPanicCollapse([piece()], 600);
    const decayed = decayPanic(collapsed, 600);
    expect(decayed[0]?.panicPermille).toBeUndefined();
    expect(
      withoutPanic(collapsed[0] as PieceState).panicPermille,
    ).toBeUndefined();
  });

  it('penalizes only lonely pieces in the desertion stay term', () => {
    const departed = piece({ id: 'w:P:d2', role: 'Pawn' });
    const surviving = piece({ id: 'w:P:e2', role: 'Pawn' });
    const lonelyHero = piece({
      dyadicAffinity: { [departed.id]: 80 },
    });
    const supportedHero = piece({
      dyadicAffinity: { [departed.id]: 80, [surviving.id]: 80 },
    });
    const lonely = withConfig(
      { LONELINESS_STAY_PENALTY_PERMILLE: 500 },
      () =>
        shouldDesert(lonelyHero, context({ departedPeerIds: [departed.id] }), [
          lonelyHero,
          surviving,
        ]).terms.stayAttachmentWeightPermille ?? 0,
    );
    const supported = withConfig(
      { LONELINESS_STAY_PENALTY_PERMILLE: 500 },
      () =>
        shouldDesert(
          supportedHero,
          context({ departedPeerIds: [departed.id] }),
          [supportedHero, surviving],
        ).terms.stayAttachmentWeightPermille ?? 0,
    );
    const baseline = withConfig(
      { LONELINESS_STAY_PENALTY_PERMILLE: 0 },
      () =>
        shouldDesert(lonelyHero, context({ departedPeerIds: [departed.id] }), [
          lonelyHero,
          surviving,
        ]).terms.stayAttachmentWeightPermille ?? 0,
    );
    expect(lonely).toBeLessThan(baseline);
    expect(supported).toBe(baseline);
  });

  it('shifts same-side awe witnesses, preserves the hero and clamps affinity', () => {
    const hero = piece({ id: 'w:Q:g1' });
    const witness = piece({
      id: 'w:P:g1',
      dyadicAffinity: { [hero.id]: 90 },
    });
    const shifted = applyAweShift([hero, witness], hero.id, 50);
    expect(
      shifted.find((item) => item.id === witness.id)?.dyadicAffinity[hero.id],
    ).toBe(100);
    expect(shifted.find((item) => item.id === hero.id)).toEqual(hero);
  });

  it('increases relief lift with event count and caps the configured addition', () => {
    const below = piece({ T_i: -100 });
    const lifted = withConfig(
      {
        RELIEF_LIFT_PERMILLE_PER_EVENT: 100,
        RELIEF_LIFT_CAP_PERMILLE: 300,
      },
      () => [
        applyMorningLift(below, 0).T_i,
        applyMorningLift(below, 1).T_i,
        applyMorningLift(below, 3).T_i,
        applyMorningLift(below, 10).T_i,
      ],
    );
    expect(lifted[0]).toBeLessThanOrEqual(lifted[1] ?? 0);
    expect(lifted[1]).toBeLessThanOrEqual(lifted[2] ?? 0);
    expect(lifted[2]).toBe(lifted[3]);
  });
});
