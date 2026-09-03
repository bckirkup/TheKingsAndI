import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import { LEADERS, opponentArchetypeForLeader } from '../sim/cli';
import {
  ADAPTIVE_MEMORY_CONFIG,
  ADAPTIVE_POLICY_CONFIG,
  EXPLOIT_POLICY_CONFIG,
  LEADER_POLICY_CONFIG,
  SEMINAR_EXPLOIT_POLICY_CONFIG,
  createPriorLeaderObservation,
  legalScoredMoves,
  leaderPolicy,
  pickByScore,
  scoreLeaderMove,
  type LeaderObservation,
  updateLeaderObservation,
} from '../sim/leaders';

const ZERO_OBSERVATION = createPriorLeaderObservation();

const OFF_DIAGONAL_FEN =
  'Nrb5/ppp3n1/n4kr1/1q5p/1b1pPPQ1/1P1PR3/P3B1P1/RKB3N1 b - - 5 24';

function contextWithObservation(
  observation: LeaderObservation = ZERO_OBSERVATION,
) {
  return {
    matchIndex: 1,
    campaignMatch: 1,
    ply: 47,
    redeemerSwitchMatch: 10,
    observation,
  };
}

function withAdaptiveConfig<T>(
  changes: Partial<typeof ADAPTIVE_POLICY_CONFIG>,
  action: () => T,
): T {
  const config = ADAPTIVE_POLICY_CONFIG as unknown as Record<string, number>;
  const original = { ...config };
  Object.assign(config, changes);
  try {
    return action();
  } finally {
    Object.assign(config, original);
  }
}

function withAdaptiveMemoryConfig<T>(
  changes: Partial<typeof ADAPTIVE_MEMORY_CONFIG>,
  action: () => T,
): T {
  const config = ADAPTIVE_MEMORY_CONFIG as unknown as Record<string, number>;
  const original = { ...config };
  Object.assign(config, changes);
  try {
    return action();
  } finally {
    Object.assign(config, original);
  }
}

function overrideCount(
  style: Parameters<typeof leaderPolicy>[0],
  context: ReturnType<typeof contextWithObservation>,
): number {
  const policy = leaderPolicy(style);
  return Array.from({ length: 1_000 }, (_, index) =>
    policy.shouldOverride(createSeededRandom(index + 1), context),
  ).filter(Boolean).length;
}

function chosenMoves(
  style: Parameters<typeof leaderPolicy>[0],
  context: ReturnType<typeof contextWithObservation>,
): string[] {
  const board = LivingBoard.fromFen(OFF_DIAGONAL_FEN);
  const moves = legalScoredMoves(board);
  return Array.from({ length: 100 }, (_, index) => {
    const choice = leaderPolicy(style).chooseMove(
      board,
      moves,
      createSeededRandom(index + 1),
      context,
    );
    return choice?.features.san ?? 'none';
  });
}

function withExploitConfig<T>(
  changes: Partial<typeof EXPLOIT_POLICY_CONFIG>,
  action: () => T,
): T {
  const config = EXPLOIT_POLICY_CONFIG as unknown as Record<string, number>;
  const original = { ...config };
  Object.assign(config, changes);
  try {
    return action();
  } finally {
    Object.assign(config, original);
  }
}

function withSeminarExploitConfig<T>(
  changes: Partial<typeof SEMINAR_EXPLOIT_POLICY_CONFIG>,
  action: () => T,
): T {
  const config = SEMINAR_EXPLOIT_POLICY_CONFIG as unknown as Record<
    string,
    number
  >;
  const original = { ...config };
  Object.assign(config, changes);
  try {
    return action();
  } finally {
    Object.assign(config, original);
  }
}

describe('scripted leader move shaping', () => {
  it('penalizes a move that recreates a previously seen position', () => {
    const board = LivingBoard.standard();
    for (const intent of [
      { from: 'g1', to: 'f3' },
      { from: 'g8', to: 'f6' },
      { from: 'f3', to: 'g1' },
      { from: 'f6', to: 'g8' },
      { from: 'g1', to: 'f3' },
      { from: 'g8', to: 'f6' },
      { from: 'f3', to: 'g1' },
      { from: 'f6', to: 'g8' },
    ] as const) {
      board.applyMove(intent);
    }
    const moves = legalScoredMoves(board);
    const repeating = moves.find(
      (move) => board.repetitionCountAfter(move.intent) >= 3,
    );
    const fresh = moves.find(
      (move) => board.repetitionCountAfter(move.intent) < 3,
    );
    expect(repeating).toBeDefined();
    expect(fresh).toBeDefined();
    if (repeating === undefined || fresh === undefined) return;
    const scoreAtNoPenalty = scoreLeaderMove(board, repeating, () => 0, {
      repetitionPenalty: 0,
      pawnAdvanceWeight: 0,
    });
    const scoreAtModeratePenalty = scoreLeaderMove(board, repeating, () => 0, {
      repetitionPenalty: -250,
      pawnAdvanceWeight: 0,
    });
    const scoreAtDefaultPenalty = scoreLeaderMove(board, repeating, () => 0, {
      repetitionPenalty: LEADER_POLICY_CONFIG.repetitionPenalty,
      pawnAdvanceWeight: 0,
    });
    expect(scoreAtNoPenalty).toBeGreaterThanOrEqual(
      scoreLeaderMove(board, fresh, () => 0, {
        repetitionPenalty: 0,
        pawnAdvanceWeight: 0,
      }),
    );
    expect(scoreAtModeratePenalty).toBeLessThan(scoreAtNoPenalty);
    expect(scoreAtDefaultPenalty).toBeLessThan(scoreAtModeratePenalty);
  });

  it('wires pawn-prospect weight into the candidate score', () => {
    const board = LivingBoard.standard();
    const move = legalScoredMoves(board).find(
      (candidate) =>
        candidate.intent.from === 'e2' && candidate.intent.to === 'e4',
    );
    expect(move).toBeDefined();
    if (move === undefined) return;
    const withoutAdvance = scoreLeaderMove(board, move, () => 0, {
      repetitionPenalty: LEADER_POLICY_CONFIG.repetitionPenalty,
      pawnAdvanceWeight: 0,
    });
    const withAdvance = scoreLeaderMove(
      board,
      move,
      () => 0,
      LEADER_POLICY_CONFIG,
    );
    expect(withAdvance).toBeGreaterThan(withoutAdvance);
  });

  it('uses seeded randomness to resolve equal scores', () => {
    const board = LivingBoard.standard();
    const moves = legalScoredMoves(board);
    const config = { repetitionPenalty: 0, pawnAdvanceWeight: 0 };
    const first = pickByScore(
      board,
      moves,
      createSeededRandom(3),
      () => 0,
      config,
    );
    const second = pickByScore(
      board,
      moves,
      createSeededRandom(3),
      () => 0,
      config,
    );
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(first?.intent).toEqual(second?.intent);

    const selections = new Set(
      [1, 2, 3, 4, 5, 6, 7, 8].map(
        (seed) =>
          pickByScore(board, moves, createSeededRandom(seed), () => 0, config)
            ?.intent.from,
      ),
    );
    expect(selections.size).toBeGreaterThan(1);
  });

  it('separates care and insistence on an off-diagonal board position', () => {
    const board = LivingBoard.fromFen(
      'Nrb5/ppp3n1/n4kr1/1q5p/1b1pPPQ1/1P1PR3/P3B1P1/RKB3N1 b - - 5 24',
    );
    const moves = legalScoredMoves(board);
    const context = {
      matchIndex: 1,
      campaignMatch: 1,
      ply: 47,
      redeemerSwitchMatch: 10,
      observation: {
        matchesObserved: 0,
        refusalPermille: 0,
        desertions: 0,
        survivors: 0,
        winScore: 0,
      },
    };
    const exacting = leaderPolicy('exacting').chooseMove(
      board,
      moves,
      createSeededRandom(1),
      context,
    );
    const absentee = leaderPolicy('absentee').chooseMove(
      board,
      moves,
      createSeededRandom(1),
      context,
    );
    const steady = leaderPolicy('steady').chooseMove(
      board,
      moves,
      createSeededRandom(1),
      context,
    );
    const supportive = leaderPolicy('supportive').chooseMove(
      board,
      moves,
      createSeededRandom(1),
      context,
    );
    const pureTactician = leaderPolicy('pure_tactician').chooseMove(
      board,
      moves,
      createSeededRandom(1),
      context,
    );
    expect(exacting).toBeDefined();
    expect(absentee).toBeDefined();
    expect(steady).toBeDefined();
    expect(supportive).toBeDefined();
    expect(pureTactician).toBeDefined();
    if (
      exacting === undefined ||
      absentee === undefined ||
      steady === undefined ||
      supportive === undefined ||
      pureTactician === undefined
    ) {
      return;
    }
    expect(
      absentee.features.pCaptured - exacting.features.pCaptured,
    ).toBeGreaterThan(0.1);
    expect(steady.features.pCaptured).toBeGreaterThan(
      supportive.features.pCaptured,
    );
    expect(steady.features.pCaptured).toBeLessThan(
      pureTactician.features.pCaptured,
    );
  });

  it('orders override frequencies across the insistence axis', () => {
    const context = {
      matchIndex: 1,
      campaignMatch: 1,
      ply: 1,
      redeemerSwitchMatch: 10,
      observation: {
        matchesObserved: 0,
        refusalPermille: 0,
        desertions: 0,
        survivors: 0,
        winScore: 0,
      },
    };
    const counts = (style: Parameters<typeof leaderPolicy>[0]): number => {
      const policy = leaderPolicy(style);
      return Array.from({ length: 1_000 }, (_, index) =>
        policy.shouldOverride(createSeededRandom(index + 1), context),
      ).filter(Boolean).length;
    };
    const absentee = counts('absentee');
    const steady = counts('steady');
    const exacting = counts('exacting');
    expect(absentee).toBeLessThan(steady);
    expect(steady).toBeLessThan(exacting);
    expect(steady - absentee).toBeGreaterThan(200);
    expect(exacting - steady).toBeGreaterThan(200);
  });

  it('uses the compliant prior for the first observation', () => {
    const board = LivingBoard.fromFen(OFF_DIAGONAL_FEN);
    const moves = legalScoredMoves(board);
    const context = contextWithObservation();
    for (const style of ['chastened', 'escalator', 'roster_first'] as const) {
      const adaptive = leaderPolicy(style);
      const steady = leaderPolicy('steady');
      expect(adaptive.shouldOverride(createSeededRandom(7), context)).toBe(
        steady.shouldOverride(createSeededRandom(7), context),
      );
      expect(
        adaptive.chooseMove(board, moves, createSeededRandom(7), context),
      ).toEqual(
        steady.chooseMove(board, moves, createSeededRandom(7), context),
      );
    }
  });

  it('moves a first observation fully to the observed values', () => {
    const observed: LeaderObservation = {
      matchesObserved: 1,
      refusalPermille: 800,
      desertions: 4,
      survivors: 9,
      winScore: 40,
    };
    expect(updateLeaderObservation(ZERO_OBSERVATION, observed)).toEqual({
      ...observed,
      matchesObserved: 1,
    });
  });

  it('moves a veteran belief by only the capped fraction', () => {
    const belief: LeaderObservation = {
      matchesObserved: ADAPTIVE_MEMORY_CONFIG.memoryCapMatches,
      refusalPermille: 0,
      desertions: 0,
      survivors: 16,
      winScore: 50,
    };
    expect(
      updateLeaderObservation(belief, {
        matchesObserved: 1,
        refusalPermille: 1_000,
        desertions: 10,
        survivors: 0,
        winScore: 0,
      }),
    ).toEqual({
      matchesObserved: ADAPTIVE_MEMORY_CONFIG.memoryCapMatches + 1,
      refusalPermille: 166,
      desertions: 1,
      survivors: 14,
      winScore: 42,
    });
  });

  it('advances by one when integer truncation would otherwise stall', () => {
    const belief: LeaderObservation = {
      matchesObserved: 20,
      refusalPermille: 10,
      desertions: 2,
      survivors: 10,
      winScore: 50,
    };
    expect(
      updateLeaderObservation(belief, {
        matchesObserved: 1,
        refusalPermille: 11,
        desertions: 3,
        survivors: 9,
        winScore: 49,
      }),
    ).toEqual({
      matchesObserved: 21,
      refusalPermille: 11,
      desertions: 3,
      survivors: 9,
      winScore: 49,
    });
  });

  it('is deterministic for identical beliefs and observations', () => {
    const belief: LeaderObservation = {
      matchesObserved: 3,
      refusalPermille: 300,
      desertions: 2,
      survivors: 12,
      winScore: 60,
    };
    const observed: LeaderObservation = {
      matchesObserved: 1,
      refusalPermille: 700,
      desertions: 6,
      survivors: 8,
      winScore: 30,
    };
    expect(updateLeaderObservation(belief, observed)).toEqual(
      updateLeaderObservation(belief, observed),
    );
  });

  it.each([
    ['memoryCapMatches', { matchesObserved: 10 }],
    ['badNewsWeightPermille', { matchesObserved: 4, refusalPermille: 100 }],
  ] as const)(
    'wires adaptive memory knob %s into a quantitative belief output',
    (knob, beliefChanges) => {
      const baseline = createPriorLeaderObservation();
      const belief = {
        ...baseline,
        ...(beliefChanges ?? {}),
      };
      const observed: LeaderObservation = {
        matchesObserved: 1,
        refusalPermille: 800,
        desertions: 5,
        survivors: 8,
        winScore: 30,
      };
      const low = knob === 'badNewsWeightPermille' ? 1_000 : 0;
      const high = knob === 'memoryCapMatches' ? 20 : 2_000;
      const lowOutput = withAdaptiveMemoryConfig({ [knob]: low }, () =>
        updateLeaderObservation(belief, observed),
      );
      const highOutput = withAdaptiveMemoryConfig({ [knob]: high }, () =>
        updateLeaderObservation(belief, observed),
      );
      expect(highOutput).not.toEqual(lowOutput);
    },
  );

  it('wires prior refusal into first-match override behavior', () => {
    const count = (
      style: 'chastened' | 'escalator',
      priorRefusalPermille: number,
    ) =>
      withAdaptiveMemoryConfig({ priorRefusalPermille }, () =>
        overrideCount(
          style,
          contextWithObservation(createPriorLeaderObservation()),
        ),
      );
    expect(count('chastened', 0)).not.toBe(count('chastened', 800));
    expect(count('escalator', 0)).not.toBe(count('escalator', 800));
  });

  it('wires prior desertions into first-match chastened move behavior', () => {
    const moves = (priorDesertions: number) =>
      withAdaptiveMemoryConfig({ priorDesertions }, () =>
        chosenMoves(
          'chastened',
          contextWithObservation(createPriorLeaderObservation()),
        ),
      );
    expect(moves(0)).not.toEqual(moves(10));
  });

  it('wires prior survivors into first-match roster-first move behavior', () => {
    const moves = (priorSurvivors: number) =>
      withAdaptiveMemoryConfig({ priorSurvivors }, () =>
        chosenMoves(
          'roster_first',
          contextWithObservation(createPriorLeaderObservation()),
        ),
      );
    expect(moves(16)).not.toEqual(moves(4));
  });

  it('retains prior win score without claiming a policy wiring', () => {
    // winScore is retained in the belief record but read by no policy yet.
    const prior = (priorWinScore: number) =>
      withAdaptiveMemoryConfig(
        { priorWinScore },
        () => createPriorLeaderObservation().winScore,
      );
    expect(prior(0)).toBe(0);
    expect(prior(100)).toBe(100);
  });

  it('moves chastened and escalator insistence in opposite directions', () => {
    const context = contextWithObservation({
      matchesObserved: 1,
      refusalPermille: 800,
      desertions: 0,
      survivors: 16,
      winScore: 50,
    });
    const chastened = overrideCount('chastened', context);
    const steady = overrideCount('steady', context);
    const escalator = overrideCount('escalator', context);
    expect(chastened).toBeLessThan(steady);
    expect(escalator).toBeGreaterThan(steady);
  });

  it('registers the D204 exploit leaders as player-only styles', () => {
    expect(LEADERS).toEqual(
      expect.arrayContaining([
        'win_maxer',
        'generation_cycler',
        'cascade_dodger',
        'dismissal_fisher',
        'tanker',
        'commendation_farmer',
      ]),
    );
    for (const leader of [
      'dismissal_fisher',
      'tanker',
      'commendation_farmer',
    ] as const) {
      expect(() => opponentArchetypeForLeader(leader)).toThrow(
        'has no opposing commander archetype',
      );
    }
  });

  it('makes win-maxer insist while the room complies', () => {
    const compliant = contextWithObservation({
      matchesObserved: 1,
      refusalPermille: 0,
      desertions: 0,
      survivors: 16,
      winScore: 50,
    });
    const hostile = contextWithObservation({
      ...compliant.observation,
      refusalPermille: EXPLOIT_POLICY_CONFIG.winMaxerCompliancePermille + 50,
    });
    const compliantCount = overrideCount('win_maxer', compliant);
    const hostileCount = overrideCount('win_maxer', hostile);
    expect(compliantCount).toBeGreaterThan(800);
    expect(hostileCount).toBe(0);
  });

  it('cycles from sharp insistence into a low-insistence lull', () => {
    const aggressive = contextWithObservation({
      matchesObserved: 1,
      refusalPermille: 0,
      desertions: 0,
      survivors: 16,
      winScore: 50,
    });
    const lull = contextWithObservation({
      ...aggressive.observation,
      desertions: EXPLOIT_POLICY_CONFIG.cyclerDesertionCeiling,
    });
    const aggressiveCount = overrideCount('generation_cycler', aggressive);
    const lullCount = overrideCount('generation_cycler', lull);
    expect(aggressiveCount).toBeGreaterThan(800);
    expect(lullCount).toBeGreaterThan(0);
    expect(lullCount).toBeLessThan(100);

    const board = LivingBoard.fromFen(OFF_DIAGONAL_FEN);
    const moves = legalScoredMoves(board);
    const aggressiveChoice = leaderPolicy('generation_cycler').chooseMove(
      board,
      moves,
      createSeededRandom(7),
      aggressive,
    );
    const lullChoice = leaderPolicy('generation_cycler').chooseMove(
      board,
      moves,
      createSeededRandom(7),
      lull,
    );
    expect(aggressiveChoice).toBeDefined();
    expect(lullChoice).toBeDefined();
    if (aggressiveChoice === undefined || lullChoice === undefined) return;
    expect(aggressiveChoice.features.pCaptured).toBeGreaterThanOrEqual(
      lullChoice.features.pCaptured,
    );
  });

  it('makes cascade-dodger passive below the survivor floor', () => {
    const healthy = contextWithObservation({
      matchesObserved: 1,
      refusalPermille: 0,
      desertions: 0,
      survivors: EXPLOIT_POLICY_CONFIG.dodgerSurvivorFloor + 4,
      winScore: 50,
    });
    const thin = contextWithObservation({
      ...healthy.observation,
      survivors: EXPLOIT_POLICY_CONFIG.dodgerSurvivorFloor - 1,
    });
    expect(overrideCount('cascade_dodger', healthy)).toBeGreaterThan(800);
    expect(overrideCount('cascade_dodger', thin)).toBe(0);
  });

  it('makes dismissal-fisher insist without a compliance brake', () => {
    const context = contextWithObservation({
      matchesObserved: 1,
      refusalPermille: 1_000,
      desertions: 20,
      survivors: 1,
      winScore: 0,
    });
    expect(overrideCount('dismissal_fisher', context)).toBeGreaterThan(800);
    const fisherConfig = EXPLOIT_POLICY_CONFIG as unknown as Record<
      string,
      number
    >;
    const insistence = fisherConfig.fisherInsistence;
    expect(
      withExploitConfig({ fisherInsistence: 0 }, () =>
        overrideCount('dismissal_fisher', context),
      ),
    ).toBe(0);
    expect(fisherConfig.fisherInsistence).toBe(insistence);
  });

  it('gives each exploit leader a defined choice with neutral bias', () => {
    const board = LivingBoard.fromFen(OFF_DIAGONAL_FEN);
    const moves = legalScoredMoves(board);
    const context = contextWithObservation({
      matchesObserved: 1,
      refusalPermille: 0,
      desertions: 0,
      survivors: 16,
      winScore: 50,
    });
    for (const style of [
      'win_maxer',
      'generation_cycler',
      'cascade_dodger',
      'dismissal_fisher',
    ] as const) {
      const choice = leaderPolicy(style).chooseMove(
        board,
        moves,
        createSeededRandom(7),
        context,
      );
      expect(choice).toBeDefined();
      expect(choice?.leaderImpliedBias).toBe(0.5);
    }
  });

  it('is deterministic for each exploit style and observation', () => {
    const board = LivingBoard.fromFen(OFF_DIAGONAL_FEN);
    const moves = legalScoredMoves(board);
    const context = contextWithObservation({
      matchesObserved: 2,
      refusalPermille: 650,
      desertions: 1,
      survivors: 11,
      winScore: 40,
    });
    for (const style of [
      'win_maxer',
      'generation_cycler',
      'cascade_dodger',
      'dismissal_fisher',
    ] as const) {
      const policy = leaderPolicy(style);
      expect(
        policy.chooseMove(board, moves, createSeededRandom(7), context),
      ).toEqual(
        policy.chooseMove(board, moves, createSeededRandom(7), context),
      );
      expect(policy.shouldOverride(createSeededRandom(7), context)).toBe(
        policy.shouldOverride(createSeededRandom(7), context),
      );
    }
  });

  it('is deterministic for each adaptive style and observation', () => {
    const board = LivingBoard.fromFen(OFF_DIAGONAL_FEN);
    const moves = legalScoredMoves(board);
    const context = contextWithObservation({
      matchesObserved: 2,
      refusalPermille: 650,
      desertions: 4,
      survivors: 9,
      winScore: 40,
    });
    for (const style of ['chastened', 'escalator', 'roster_first'] as const) {
      const policy = leaderPolicy(style);
      const first = policy.chooseMove(
        board,
        moves,
        createSeededRandom(7),
        context,
      );
      const second = policy.chooseMove(
        board,
        moves,
        createSeededRandom(7),
        context,
      );
      expect(second).toEqual(first);
      expect(policy.shouldOverride(createSeededRandom(7), context)).toBe(
        policy.shouldOverride(createSeededRandom(7), context),
      );
    }
  });

  it.each([
    ['baseInsistence', 'chastened', ZERO_OBSERVATION, 0, 100],
    [
      'chastenedGain',
      'chastened',
      {
        matchesObserved: 1,
        refusalPermille: 800,
        desertions: 0,
        survivors: 16,
        winScore: 50,
      },
      0,
      1_000,
    ],
    [
      'escalatorGain',
      'escalator',
      {
        matchesObserved: 1,
        refusalPermille: 800,
        desertions: 0,
        survivors: 16,
        winScore: 50,
      },
      0,
      1_000,
    ],
    [
      'escalatorCeiling',
      'escalator',
      {
        matchesObserved: 1,
        refusalPermille: 1_000,
        desertions: 0,
        survivors: 16,
        winScore: 50,
      },
      0,
      100,
    ],
    [
      'thinRoster',
      'roster_first',
      {
        matchesObserved: 1,
        refusalPermille: 0,
        desertions: 0,
        survivors: 10,
        winScore: 50,
      },
      0,
      20,
    ],
  ] as const)(
    'wires %s into a quantitative override output',
    (knob, style, observation, low, high) => {
      const context = contextWithObservation(observation);
      const lowCount = withAdaptiveConfig(
        { [knob]: low } as Partial<typeof ADAPTIVE_POLICY_CONFIG>,
        () => overrideCount(style, context),
      );
      const highCount = withAdaptiveConfig(
        { [knob]: high } as Partial<typeof ADAPTIVE_POLICY_CONFIG>,
        () => overrideCount(style, context),
      );
      expect(lowCount).not.toBe(highCount);
    },
  );

  it.each([
    ['baseRisk', 'escalator', 'baseRisk', 0, 100],
    ['chastenedRiskGain', 'chastened', 'chastenedRiskGain', 0, 40],
    ['chastenedRiskCeiling', 'chastened', 'chastenedRiskCeiling', 8, 100],
    ['scarcityGain', 'roster_first', 'scarcityGain', 0, 40],
  ] as const)(
    'wires %s into a quantitative move output',
    (_label, style, knob, low, high) => {
      const context = contextWithObservation({
        matchesObserved: 1,
        refusalPermille: 0,
        desertions: 8,
        survivors: 4,
        winScore: 50,
      });
      const lowMoves = withAdaptiveConfig(
        { [knob]: low } as Partial<typeof ADAPTIVE_POLICY_CONFIG>,
        () => chosenMoves(style, context),
      );
      const highMoves = withAdaptiveConfig(
        { [knob]: high } as Partial<typeof ADAPTIVE_POLICY_CONFIG>,
        () => chosenMoves(style, context),
      );
      expect(highMoves).not.toEqual(lowMoves);
    },
  );

  it('tanks only while above the bottom seminar standing', () => {
    const board = LivingBoard.fromFen(OFF_DIAGONAL_FEN);
    const moves = legalScoredMoves(board);
    const seminarContext = {
      ...contextWithObservation(),
      seminar: {
        week: 1,
        weeksPerSemester: 4,
        standingRank: 3,
        cohortSize: 4,
      },
    };
    const tanked = leaderPolicy('tanker').chooseMove(
      board,
      moves,
      createSeededRandom(11),
      seminarContext,
    );
    const bottom = leaderPolicy('tanker').chooseMove(
      board,
      moves,
      createSeededRandom(11),
      {
        ...seminarContext,
        seminar: { ...seminarContext.seminar, standingRank: 4 },
      },
    );
    expect(tanked?.features.san).not.toBe(bottom?.features.san);
  });

  it('switches tanking behavior when the opening-week knob changes', () => {
    const board = LivingBoard.fromFen(OFF_DIAGONAL_FEN);
    const moves = legalScoredMoves(board);
    const context = {
      ...contextWithObservation(),
      seminar: {
        week: 1,
        weeksPerSemester: 4,
        standingRank: 1,
        cohortSize: 2,
      },
    };
    const neverTanks = withSeminarExploitConfig({ tankerTankWeeks: 0 }, () =>
      leaderPolicy('tanker').chooseMove(
        board,
        moves,
        createSeededRandom(11),
        context,
      ),
    );
    const tanks = withSeminarExploitConfig({ tankerTankWeeks: 2 }, () =>
      leaderPolicy('tanker').chooseMove(
        board,
        moves,
        createSeededRandom(11),
        context,
      ),
    );
    expect(neverTanks?.features.san).not.toBe(tanks?.features.san);
  });

  it('uses the play phase without seminar context', () => {
    const board = LivingBoard.fromFen(OFF_DIAGONAL_FEN);
    const moves = legalScoredMoves(board);
    const policy = leaderPolicy('tanker');
    const context = contextWithObservation();
    const withoutSeminar = policy.chooseMove(
      board,
      moves,
      createSeededRandom(11),
      context,
    );
    const explicitPlay = policy.chooseMove(
      board,
      moves,
      createSeededRandom(11),
      {
        ...context,
        seminar: {
          week: 3,
          weeksPerSemester: 4,
          standingRank: 2,
          cohortSize: 2,
        },
      },
    );
    expect(withoutSeminar).toEqual(explicitPlay);
  });

  it('probes each seminar exploiter configuration knob', () => {
    const context = {
      ...contextWithObservation(),
      seminar: {
        week: 1,
        weeksPerSemester: 4,
        standingRank: 1,
        cohortSize: 2,
      },
    };
    const tankWeeks = withSeminarExploitConfig({ tankerTankWeeks: 0 }, () =>
      overrideCount('tanker', context),
    );
    const tankWeeksEnabled = withSeminarExploitConfig(
      { tankerTankWeeks: 2 },
      () => overrideCount('tanker', context),
    );
    expect(tankWeeks).not.toBe(tankWeeksEnabled);
    const tankInsistence = withSeminarExploitConfig(
      { tankerTankInsistence: 0 },
      () => overrideCount('tanker', context),
    );
    const tankInsistenceHigh = withSeminarExploitConfig(
      { tankerTankInsistence: 100 },
      () => overrideCount('tanker', context),
    );
    expect(tankInsistence).not.toBe(tankInsistenceHigh);
    const playInsistence = withSeminarExploitConfig(
      { tankerTankWeeks: 0, tankerPlayInsistence: 0 },
      () => overrideCount('tanker', context),
    );
    const playInsistenceHigh = withSeminarExploitConfig(
      { tankerTankWeeks: 0, tankerPlayInsistence: 100 },
      () => overrideCount('tanker', context),
    );
    expect(playInsistence).not.toBe(playInsistenceHigh);
  });

  it('rotates commendation farmer attention and never overrides', () => {
    const board = LivingBoard.standard();
    const moves = legalScoredMoves(board);
    const farmer = leaderPolicy('commendation_farmer');
    const moverIds = new Set(
      Array.from({ length: 8 }, (_, ply) => {
        const choice = farmer.chooseMove(
          board,
          moves,
          createSeededRandom(ply + 1),
          { ...contextWithObservation(), ply },
        );
        return choice?.features.moverId;
      }),
    );
    expect(moverIds.size).toBeGreaterThan(1);
    expect(
      farmer.shouldOverride(createSeededRandom(1), contextWithObservation()),
    ).toBe(false);
  });

  it('probes farmer risk weight', () => {
    const context = contextWithObservation();
    const low = withSeminarExploitConfig({ farmerRiskWeight: 0 }, () =>
      chosenMoves('commendation_farmer', context),
    );
    const high = withSeminarExploitConfig({ farmerRiskWeight: 100 }, () =>
      chosenMoves('commendation_farmer', context),
    );
    expect(low).not.toEqual(high);
  });
});
