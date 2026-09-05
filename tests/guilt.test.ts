import { describe, expect, it } from 'vitest';

import {
  ENGINE_CONFIG,
  foldGuilt,
  guiltForMove,
  type CandidateMoveEvaluation,
  type MatchEvent,
} from '../src/psychology';

function withConfig<T>(
  values: Readonly<Record<string, number>>,
  run: () => T,
): T {
  const config = ENGINE_CONFIG as unknown as Record<string, number>;
  const originals = Object.keys(values).map(
    (key) => [key, config[key] ?? 0] as const,
  );
  try {
    for (const [key, value] of Object.entries(values)) config[key] = value;
    return run();
  } finally {
    for (const [key, value] of originals) config[key] = value;
  }
}

function firstDesertion(pieceId: string, ply: number): MatchEvent {
  return {
    t: 'DESERTION',
    ply,
    pieceId,
    refusedMove: 'a2a3',
    uStay: 0,
    uDesert: 1,
    departureKind: 'first',
  };
}

function cascadeDesertion(pieceId: string, ply: number): MatchEvent {
  return {
    t: 'DESERTION',
    ply,
    pieceId,
    refusedMove: 'a2a3',
    uStay: 0,
    uDesert: 1,
    departureKind: 'cascade',
  };
}

function move(
  pieceId: string,
  ply: number,
  spentPeers?: Readonly<Record<string, number>>,
): MatchEvent {
  return {
    t: 'MOVE',
    ply,
    san: 'Nf3',
    pieceId,
    verdict: 'COMPLIANT_EXECUTION',
    ...(spentPeers === undefined ? {} : { guilt: { spentPeers } }),
  };
}

function capture(victim: string, by: string, ply: number): MatchEvent {
  return { t: 'CAPTURE', ply, victim, by };
}

function evaluation(
  peerSafetyDeltas: Readonly<Record<string, number>>,
): CandidateMoveEvaluation {
  return {
    moveNotation: 'Nf3',
    deltaV_board: 0,
    privateScoreCp: 0,
    vLeaderImplied: 0,
    deltaV_capture: 0,
    P_captured: 0,
    peerSafetyDeltas,
    promotionProspect: 0,
  };
}

describe('D213 guilt', () => {
  it('is disabled by both zero sentinels and does not annotate moves', () => {
    const events = [
      firstDesertion('deserter', 2),
      cascadeDesertion('follower', 3),
      move('survivor', 4, { peer: -100 }),
      capture('peer', 'enemy', 5),
    ];
    withConfig({ GUILT_PEER_SAFETY_FLOOR: 0 }, () => {
      expect(foldGuilt(events, ['deserter', 'survivor'])).toEqual({
        incidents: [],
        count: 0,
      });
      expect(guiltForMove(evaluation({ peer: -100 }))).toBeUndefined();
    });
  });

  it('grades cascade windows by follower count', () => {
    const events = [
      firstDesertion('deserter', 2),
      cascadeDesertion('near', 3),
      cascadeDesertion('far', 5),
    ];
    const counts = [1, 2, 3].map((window) =>
      withConfig(
        {
          GUILT_CASCADE_WINDOW_PLIES: window,
          GUILT_PEER_SAFETY_FLOOR: 0,
        },
        () => foldGuilt(events, ['deserter']).incidents,
      ),
    );
    expect(counts.map((incidents) => incidents[0])).toEqual([
      expect.objectContaining({ followers: 1 }),
      expect.objectContaining({ followers: 1 }),
      expect.objectContaining({ followers: 2 }),
    ]);
  });

  it('grades safety floors and requires an in-window direct capture', () => {
    const eventsForFloor = (floor: number): MatchEvent[] =>
      withConfig({ GUILT_PEER_SAFETY_FLOOR: floor }, () => [
        move(
          'survivor',
          4,
          guiltForMove(evaluation({ near: -30, deep: -80 }))?.spentPeers,
        ),
        capture('near', 'enemy', 5),
        capture('deep', 'enemy', 6),
      ]);
    const counts = [5, 50, 90].map((floor) =>
      withConfig(
        {
          GUILT_CASCADE_WINDOW_PLIES: 0,
          GUILT_PEER_SAFETY_FLOOR: floor,
          GUILT_CAPTURE_WINDOW_PLIES: 2,
        },
        () => foldGuilt(eventsForFloor(floor), ['survivor']).count,
      ),
    );
    expect(counts).toEqual([2, 1, 0]);
    const events = eventsForFloor(5);
    expect(
      withConfig(
        {
          GUILT_CASCADE_WINDOW_PLIES: 0,
          GUILT_PEER_SAFETY_FLOOR: 5,
          GUILT_CAPTURE_WINDOW_PLIES: 1,
        },
        () => foldGuilt(events, ['survivor']).count,
      ),
    ).toBe(1);
    expect(
      withConfig(
        {
          GUILT_CASCADE_WINDOW_PLIES: 0,
          GUILT_PEER_SAFETY_FLOOR: 5,
          GUILT_CAPTURE_WINDOW_PLIES: 0,
        },
        () => foldGuilt(events, ['survivor']).count,
      ),
    ).toBe(0);
  });

  it('emits positive safety magnitudes only at or beyond the floor', () => {
    const result = withConfig(
      {
        GUILT_PEER_SAFETY_FLOOR: 20,
      },
      () => guiltForMove(evaluation({ shallow: -19, spent: -20, more: -80 })),
    );
    expect(result).toEqual({
      spentPeers: { spent: 20, more: 80 },
    });
  });

  it('gates direct links, applies fielding, and sorts deterministically', () => {
    const events: MatchEvent[] = [
      cascadeDesertion('early', 1),
      firstDesertion('deserter', 2),
      cascadeDesertion('follower', 3),
      move('survivor', 4, { 'w:peer:b': 30, 'w:peer:a': 30 }),
      capture('w:peer:a', 'enemy', 5),
      capture('w:peer:b', 'enemy', 5),
      capture('other', 'enemy', 5),
      move('unfielded', 6, { peer: -50 }),
      capture('peer', 'enemy', 7),
    ];
    const folded = withConfig(
      {
        GUILT_CASCADE_WINDOW_PLIES: 2,
        GUILT_PEER_SAFETY_FLOOR: 20,
        GUILT_CAPTURE_WINDOW_PLIES: 2,
      },
      () => foldGuilt(events, ['deserter', 'survivor']),
    );
    expect(folded).toEqual({
      incidents: [
        {
          kind: 'deserter',
          pieceId: 'deserter',
          ply: 2,
          followers: 1,
        },
        {
          kind: 'survivor',
          pieceId: 'survivor',
          ply: 4,
          peerId: 'w:peer:a',
          safetySpent: 30,
          capturePly: 5,
        },
        {
          kind: 'survivor',
          pieceId: 'survivor',
          ply: 4,
          peerId: 'w:peer:b',
          safetySpent: 30,
          capturePly: 5,
        },
      ],
      count: 3,
    });
  });

  it('rejects cascades before or outside the window and missing or wrong captures', () => {
    const events: MatchEvent[] = [
      cascadeDesertion('before', 1),
      firstDesertion('deserter', 2),
      cascadeDesertion('outside', 5),
      move('survivor', 4, { peer: -20, missing: -20, wrong: -20 }),
      capture('wrong', 'enemy', 7),
      capture('peer', 'enemy', 8),
    ];
    expect(
      withConfig(
        {
          GUILT_CASCADE_WINDOW_PLIES: 2,
          GUILT_PEER_SAFETY_FLOOR: 10,
          GUILT_CAPTURE_WINDOW_PLIES: 2,
        },
        () => foldGuilt(events, ['deserter', 'survivor']),
      ),
    ).toEqual({ incidents: [], count: 0 });
  });
});
