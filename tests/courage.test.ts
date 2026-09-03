import { describe, expect, it } from 'vitest';

import { LivingBoard, extractMoveFeatures } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import { createFakeEnginePort } from '../src/engine/fake';
import {
  courageForMove,
  ENGINE_CONFIG,
  foldCourage,
  type CandidateMoveEvaluation,
  type MatchEvent,
  type MoveDecisionOutcome,
} from '../src/psychology';
import {
  featuresToEvaluation,
  runHeadlessMatch,
  type HeadlessLeaderPort,
} from '../src/orchestration';
import { createStartingRoster } from '../sim/roster';

const moveEval: CandidateMoveEvaluation = {
  moveNotation: 'e4',
  deltaV_board: -0.2,
  privateScoreCp: 0,
  vLeaderImplied: 0,
  deltaV_capture: 0,
  P_captured: 0.02,
  peerSafetyDeltas: {},
  promotionProspect: 0,
};

function outcome(
  verdict: MoveDecisionOutcome['verdict'],
  utilityScore: number,
): MoveDecisionOutcome {
  return {
    verdict,
    utilityScore,
    perceivedValue: utilityScore,
    refusalThreshold: -3,
    effectiveSearchDepth: 2,
    engagementFactor: 1,
  };
}

describe('courageForMove', () => {
  it.each(['MORAL_REFUSAL', 'QUIET_QUITTING', 'DESERTION_MUTINY'] as const)(
    'excludes %s',
    (verdict) => {
      expect(courageForMove(outcome(verdict, -1), moveEval)).toBeUndefined();
    },
  );

  it('excludes non-negative utility even for full effort', () => {
    expect(
      courageForMove(outcome('COMPLIANT_EXECUTION', 0), moveEval),
    ).toBeUndefined();
    expect(
      courageForMove(outcome('HEROIC_EXECUTION', 1), moveEval),
    ).toBeUndefined();
  });

  it('records the overcome margin and trait-free ask', () => {
    expect(
      courageForMove(outcome('HEROIC_EXECUTION', -1.25), {
        ...moveEval,
        P_captured: 0.4,
        deltaV_board: -0.7,
      }),
    ).toEqual({ margin: 1.25, asked: 0.7 });
  });

  it('uses the configured ask floor', () => {
    expect(
      courageForMove(outcome('COMPLIANT_EXECUTION', -0.5), {
        ...moveEval,
        deltaV_board: -0.01,
      }),
    ).toEqual({
      margin: 0.5,
      asked: ENGINE_CONFIG.COURAGE_ASKED_COST_FLOOR,
    });
  });
});

describe('foldCourage', () => {
  it('is risk-relative and aggregates by mean rather than volume', () => {
    const incidents = [0.2, 0.4, 0.8].map((risk, index) => {
      const courage = courageForMove(
        outcome('COMPLIANT_EXECUTION', -0.6 * risk),
        {
          ...moveEval,
          deltaV_board: 0,
          P_captured: risk,
        },
      );
      if (courage === undefined) throw new Error('Expected a courage act.');
      return {
        t: 'MOVE' as const,
        ply: index + 1,
        san: `m${index}`,
        pieceId: 'w:P:e2',
        verdict: 'COMPLIANT_EXECUTION' as const,
        courage,
      };
    });
    const folded = foldCourage(incidents, ['w:P:e2']);
    const doubled = foldCourage([...incidents, ...incidents], ['w:P:e2']);
    expect(folded.incidents[0]?.normalized).toBeCloseTo(0.6, 12);
    expect(folded.incidents[1]?.normalized).toBeCloseTo(0.6, 12);
    expect(folded.incidents[2]?.normalized).toBeCloseTo(0.6, 12);
    expect(
      folded.incidents.every(
        (incident) => Math.abs(incident.normalized - 0.6) <= 1e-9,
      ),
    ).toBe(true);
    expect(doubled.meanNormalized).toBe(folded.meanNormalized);
    expect(doubled.count).toBe(folded.count * 2);
  });

  it('caps seeded randomized readings and returns null when empty', () => {
    const random = createSeededRandom(199);
    const events: MatchEvent[] = Array.from({ length: 24 }, (_, index) => {
      const asked = 0.01 + random.nextFloat() * 2;
      const margin = random.nextFloat() * 4;
      return {
        t: 'MOVE',
        ply: index + 1,
        san: `m${index}`,
        pieceId: 'w:P:e2',
        verdict: 'FATALISTIC_COMPLIANCE',
        courage: { margin, asked },
      };
    });
    const folded = foldCourage(events, ['w:P:e2']);
    expect(
      folded.incidents.every(
        (incident) => incident.normalized >= 0 && incident.normalized <= 1,
      ),
    ).toBe(true);
    expect(foldCourage([], ['w:P:e2']).meanNormalized).toBeNull();
  });
});

describe('headless courage emission', () => {
  it('emits only positive full-effort courage readings for non-Kings', async () => {
    const leader: HeadlessLeaderPort = {
      chooseMove(board, side, _random, _ply, refusedSans = new Set()) {
        const candidate = board.legalMoves().find((intent) => {
          const features = extractMoveFeatures(board, intent);
          return (
            board.pieceAt(intent.from)?.side === side &&
            !refusedSans.has(features.san)
          );
        });
        if (candidate === undefined) return undefined;
        const features = extractMoveFeatures(board, candidate);
        return {
          moverId: board.pieceAt(candidate.from)?.id ?? '',
          intent: candidate,
          san: features.san,
          moveEval: {
            ...featuresToEvaluation(features),
            deltaV_board: -10,
            P_captured: 0.2,
          },
          objectivelyGood: false,
        };
      },
      shouldOverride: () => false,
    };
    const board = LivingBoard.standard();
    const result = await runHeadlessMatch({
      random: createSeededRandom(199),
      maxPlies: 2,
      playerSide: 'w',
      leader,
      opponent: leader,
      initialBoard: board,
      initialRoster: createStartingRoster(board, 'w', 100, 0.5),
      initialEnemyRoster: createStartingRoster(board, 'b', 100, 0.5),
      engine: createFakeEnginePort(),
    });
    const courageEvents = result.events.filter(
      (event): event is Extract<MatchEvent, { t: 'MOVE' }> =>
        event.t === 'MOVE' && event.courage !== undefined,
    );
    expect(courageEvents.length).toBeGreaterThan(0);
    expect(
      courageEvents.every(
        (event) =>
          event.pieceId.includes(':') &&
          event.courage !== undefined &&
          event.courage.margin > 0 &&
          event.courage.asked >= ENGINE_CONFIG.COURAGE_ASKED_COST_FLOOR &&
          [
            'COMPLIANT_EXECUTION',
            'HEROIC_EXECUTION',
            'FATALISTIC_COMPLIANCE',
          ].includes(event.verdict),
      ),
    ).toBe(true);
  });
});
