import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FEATURE_CONFIG,
  LivingBoard,
  captureRiskThousandths,
  extractAllMoveFeatures,
  extractMoveFeatures,
  extractThreatMap,
  kingExposureThousandths,
  materialBalance,
  promotionProspectThousandths,
} from '../src/chess';
import type { FeatureConfig, MoveIntent, Square } from '../src/chess';
import { canonicalJson } from '../src/core/canonicalJson';

const config = DEFAULT_FEATURE_CONFIG;

/** White knight on e4 attacked by a black pawn on d5, defended by nothing. */
const HANGING_KNIGHT =
  'r1bqkb1r/ppp2ppp/2n5/3p4/4N3/8/PPPP1PPP/R1BQKB1R w KQkq - 0 1';

describe('threat feature golden values', () => {
  it('computes bounded, mirrored promotion prospect and obstruction damping', () => {
    const white = LivingBoard.fromFen('4k3/8/8/8/8/8/P7/4K3 w - - 0 1');
    const black = LivingBoard.fromFen('4k3/p7/8/8/8/8/8/4K3 b - - 0 1');
    expect(promotionProspectThousandths(white, 'a2', config)).toBe(0);
    expect(promotionProspectThousandths(black, 'a7', config)).toBe(0);
    const advancedWhite = LivingBoard.fromFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    const advancedBlack = LivingBoard.fromFen('4k3/8/8/8/8/8/p7/4K3 b - - 0 1');
    expect(promotionProspectThousandths(advancedWhite, 'a7', config)).toBe(
      1000,
    );
    expect(promotionProspectThousandths(advancedBlack, 'a2', config)).toBe(
      1000,
    );
    const blocked = LivingBoard.fromFen('4k3/p7/8/P7/8/8/8/4K3 w - - 0 1');
    expect(promotionProspectThousandths(blocked, 'a5', config)).toBe(300);
    expect(
      promotionProspectThousandths(blocked, 'a5', {
        ...config,
        promotionProspectBlockedDamperPermille: 250,
      }),
    ).toBe(150);
  });

  it('carries advanced-pawn prospect through MoveFeatures in permille', () => {
    const advanced = LivingBoard.fromFen('4k3/8/P7/8/8/8/8/4K3 w - - 0 1');
    const advancedFeatures = extractMoveFeatures(advanced, {
      from: 'a6',
      to: 'a7',
    });
    expect(advancedFeatures.promotionProspectByPiece['w:P:a6']).toBe(1000);
  });
  it('scores a hanging knight as an undefended target', () => {
    const board = LivingBoard.fromFen(HANGING_KNIGHT);
    expect(captureRiskThousandths(board, 'e4' as Square, config)).toBe(
      config.riskUndefended,
    );
    const threats = extractThreatMap(board, 'w', config);
    expect(threats.pieces['w:N:e4']).toEqual({
      pieceId: 'w:N:e4',
      square: 'e4',
      role: 'N',
      captureRisk: 0.8,
      attackerCount: 1,
      defenderCount: 0,
    });
    expect(threats.materialBalance).toBe(0);
    expect(threats.pieces['w:P:a2']?.captureRisk).toBe(0);
  });

  it('separates undefended, outnumbered, and adequately defended risk', () => {
    // Black rook on d5 attacked by a white rook (equal value), no defenders.
    const undefended = LivingBoard.fromFen('4k3/8/8/3r4/8/8/3R4/4K3 b - - 0 1');
    expect(captureRiskThousandths(undefended, 'd5' as Square, config)).toBe(
      config.riskUndefended,
    );

    // A pawn attacked twice and defended only by its King has no profitable
    // exchange, but remains outnumbered.
    const outnumbered = LivingBoard.fromFen(
      '8/8/2k5/3p4/2P1P3/8/8/7K b - - 0 1',
    );
    expect(captureRiskThousandths(outnumbered, 'd5' as Square, config)).toBe(
      config.riskOutnumbered,
    );

    // Attacked once, defended once.
    const defended = LivingBoard.fromFen('3rk3/8/8/3r4/8/8/8/3RK3 b - - 0 1');
    expect(captureRiskThousandths(defended, 'd5' as Square, config)).toBe(
      config.riskDefended,
    );
  });

  it('never charges capture risk to a King', () => {
    const board = LivingBoard.fromFen('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
    expect(captureRiskThousandths(board, 'e1' as Square, config)).toBe(0);
    expect(extractThreatMap(board, 'w', config).pieces['w:K:e1']).toEqual(
      expect.objectContaining({ captureRisk: 0, role: 'K' }),
    );
  });

  it('scores King exposure from the attacked ring and from check', () => {
    const quiet = LivingBoard.standard();
    expect(kingExposureThousandths(quiet, 'w', config)).toBe(0);

    const inCheck = LivingBoard.fromFen('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
    // The rook on e2 gives check and attacks two ring squares, d2 and f2.
    expect(kingExposureThousandths(inCheck, 'w', config)).toBe(
      2 * config.kingRingExposure + config.kingCheckExposure,
    );
  });

  it('classifies a King attacking an undefended pawn as undefended risk', () => {
    const board = LivingBoard.fromFen('4k3/8/8/3p4/2K5/8/8/8 w - - 0 1');
    expect(captureRiskThousandths(board, 'd5' as Square, config)).toBe(
      config.riskUndefended,
    );
  });

  it('drops a King attacker from a defended exchange classification', () => {
    const board = LivingBoard.fromFen('8/8/2k5/3p4/2K1PN2/8/8/8 w - - 0 1');
    expect(captureRiskThousandths(board, 'd5' as Square, config)).toBe(
      config.riskOutnumbered,
    );
  });

  it('classifies a rook taking a pawn-defended knight as a losing trade', () => {
    const board = LivingBoard.fromFen('k7/8/4p3/3n4/8/8/8/3R3K w - - 0 1');
    expect(captureRiskThousandths(board, 'd5' as Square, config)).toBe(
      config.riskLosingTrade,
    );
  });

  it('classifies a pawn taking a defended knight as a favourable trade', () => {
    const board = LivingBoard.fromFen('k7/8/2p5/3n4/4P3/8/8/7K w - - 0 1');
    expect(captureRiskThousandths(board, 'd5' as Square, config)).toBe(
      config.riskFavourableTrade,
    );
  });

  it('classifies an equal exchange as defended risk', () => {
    const board = LivingBoard.fromFen('k7/8/8/3rr3/8/8/8/3R3K w - - 0 1');
    expect(captureRiskThousandths(board, 'd5' as Square, config)).toBe(
      config.riskDefended,
    );
  });

  it('classifies a hanging piece as an undefended risk', () => {
    const board = LivingBoard.fromFen('k7/8/8/3n4/4P3/8/8/7K w - - 0 1');
    expect(captureRiskThousandths(board, 'd5' as Square, config)).toBe(
      config.riskUndefended,
    );
  });

  it('classifies two attackers on one defender by exchange gain', () => {
    const board = LivingBoard.fromFen('k7/8/8/R2rr3/8/8/8/3R3K w - - 0 1');
    expect(captureRiskThousandths(board, 'd5' as Square, config)).toBe(
      config.riskFavourableTrade,
    );
  });

  it('computes material balance from the given side', () => {
    const board = LivingBoard.fromFen(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBN1 w Qkq - 0 1',
    );
    expect(materialBalance(board, 'w', config)).toBe(-5);
    expect(materialBalance(board, 'b', config)).toBe(5);
  });
});

describe('move feature golden values', () => {
  it('reports capture value, material delta, and the mover risk it walks into', () => {
    const board = LivingBoard.fromFen(
      'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    );
    const features = extractMoveFeatures(
      board,
      { from: 'e4', to: 'd5' } as MoveIntent,
      config,
    );
    expect(features.san).toBe('exd5');
    expect(features.moverId).toBe('w:P:e4');
    expect(features.deltaVCapture).toBe(1);
    expect(features.materialDelta).toBe(1);
    // The pawn now stands on d5 attacked by the queen alone, and undefended.
    expect(features.pCaptured).toBe(0.8);
    // It was already an undefended target on e4, so its own risk is unchanged.
    expect(features.pCapturedDelta).toBe(0);
    expect(features.kingSafetyDelta).toBe(0);
    // The board the caller handed in is untouched.
    expect(board.pieceAt('d5' as Square)?.id).toBe('b:P:d5');
  });

  it('credits a peer whose attacker the move captures', () => {
    // Black bishop on b4 attacks the white knight on c3; axb4 removes it.
    const board = LivingBoard.fromFen(
      'rnbqk1nr/pppp1ppp/8/4p3/1b6/P1N5/1PPPPPPP/R1BQKBNR w KQkq - 0 1',
    );
    const before = extractThreatMap(board, 'w', config);
    // Attacked by the bishop, defended twice: an adequately defended piece.
    expect(before.pieces['w:N:c3']?.captureRisk).toBe(0.25);
    const features = extractMoveFeatures(
      board,
      { from: 'a3', to: 'b4' } as MoveIntent,
      config,
    );
    expect(features.deltaVCapture).toBe(3);
    expect(features.moverId).toBe('w:P:a3');
    // The knight's attacker is gone, so the knight is the peer that gained.
    expect(features.peerSafetyDeltas['w:N:c3']).toBe(0.25);
    expect(features.captureRiskByPiece['w:N:c3']).toBe(0);
    expect(features.peerSafetyDeltas['w:P:d2']).toBe(0);
  });

  it('reports a positive King safety delta when a check is answered', () => {
    const board = LivingBoard.fromFen('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
    const features = extractMoveFeatures(
      board,
      { from: 'e1', to: 'f1' } as MoveIntent,
      config,
    );
    expect(features.kingSafetyDelta).toBeGreaterThan(0);
  });

  it('scores its own army only, and never the mover as one of its peers', () => {
    const board = LivingBoard.fromFen(
      'rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 2',
    );
    const features = extractMoveFeatures(
      board,
      { from: 'e5', to: 'd4' } as MoveIntent,
      config,
    );
    expect(features.moverId).toBe('b:P:e5');
    expect(features.deltaVCapture).toBe(1);
    // The captured white pawn belongs to the other army: it is in neither map.
    expect(features.captureRiskByPiece['w:P:d4']).toBeUndefined();
    expect(features.peerSafetyDeltas['w:P:d4']).toBeUndefined();
    // The mover is scored, but only as itself, never as one of its own peers.
    expect(features.peerSafetyDeltas['b:P:e5']).toBeUndefined();
    expect(features.captureRiskByPiece['b:P:e5']).toBe(features.pCaptured);
  });

  it('is reproducible and canonically ordered for a fixed position', () => {
    const board = LivingBoard.fromFen(HANGING_KNIGHT);
    const first = extractAllMoveFeatures(board, config);
    const second = extractAllMoveFeatures(board, config);
    expect(canonicalJson(first)).toBe(canonicalJson(second));
    expect(first).toHaveLength(board.legalMoves().length);
    expect(Object.keys(first[0]?.captureRiskByPiece ?? {})).toEqual(
      [...Object.keys(first[0]?.captureRiskByPiece ?? {})].sort(),
    );
  });
});

describe('feature config sensitivity probes', () => {
  const withOverride = (override: Partial<FeatureConfig>): FeatureConfig => ({
    ...config,
    ...override,
  });

  const knightRisk = (candidate: FeatureConfig): number =>
    captureRiskThousandths(
      LivingBoard.fromFen(HANGING_KNIGHT),
      'e4' as Square,
      candidate,
    );

  it('riskFavourableTrade changes the risk of a knight attacked by a pawn', () => {
    const board = LivingBoard.fromFen('k7/8/2p5/3n4/4P3/8/8/7K w - - 0 1');
    expect(
      captureRiskThousandths(
        board,
        'd5' as Square,
        withOverride({ riskFavourableTrade: 500 }),
      ),
    ).toBe(500);
    expect(captureRiskThousandths(board, 'd5' as Square, config)).toBe(900);
  });

  it('riskUndefended changes the risk of an undefended equal trade', () => {
    const board = LivingBoard.fromFen('4k3/8/8/3r4/8/8/3R4/4K3 b - - 0 1');
    expect(
      captureRiskThousandths(
        board,
        'd5' as Square,
        withOverride({ riskUndefended: 111 }),
      ),
    ).toBe(111);
  });

  it('riskOutnumbered changes the risk of a doubly attacked, singly defended piece', () => {
    const board = LivingBoard.fromFen('8/8/2k5/3p4/2P1P3/8/8/7K b - - 0 1');
    expect(
      captureRiskThousandths(
        board,
        'd5' as Square,
        withOverride({ riskOutnumbered: 222 }),
      ),
    ).toBe(222);
  });

  it('riskDefended changes the risk of an adequately defended piece', () => {
    const board = LivingBoard.fromFen('3rk3/8/8/3r4/8/8/8/3RK3 b - - 0 1');
    expect(
      captureRiskThousandths(
        board,
        'd5' as Square,
        withOverride({ riskDefended: 333 }),
      ),
    ).toBe(333);
  });

  it('riskLosingTrade changes the risk of a losing exchange', () => {
    const board = LivingBoard.fromFen('k7/8/4p3/3n4/8/8/8/3R3K w - - 0 1');
    expect(
      captureRiskThousandths(
        board,
        'd5' as Square,
        withOverride({ riskLosingTrade: 123 }),
      ),
    ).toBe(123);
  });

  it('pieceValues change both the trade classification and material delta', () => {
    // A knight worth less than a pawn is no longer a favourable pawn capture.
    expect(
      knightRisk(
        withOverride({ pieceValues: { ...config.pieceValues, N: 1 } }),
      ),
    ).toBe(config.riskUndefended);

    const board = LivingBoard.fromFen(
      'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    );
    const dearPawns = withOverride({
      pieceValues: { ...config.pieceValues, P: 4 },
    });
    expect(
      extractMoveFeatures(
        board,
        { from: 'e4', to: 'd5' } as MoveIntent,
        dearPawns,
      ).deltaVCapture,
    ).toBe(4);
    expect(
      extractMoveFeatures(
        board,
        { from: 'e4', to: 'd5' } as MoveIntent,
        dearPawns,
      ).materialDelta,
    ).toBe(4);
  });

  it('kingAttackerValue remains a non-material sentinel', () => {
    // Black pawn on d5 attacked only by the white King on c4, defended by e6.
    const board = LivingBoard.fromFen('4k3/8/4p3/3p4/2K5/8/8/8 b - - 0 1');
    const baseline = captureRiskThousandths(board, 'd5' as Square, config);
    expect(
      captureRiskThousandths(
        board,
        'd5' as Square,
        withOverride({ kingAttackerValue: 0 }),
      ),
    ).toBe(baseline);
    expect(baseline).not.toBe(config.riskLosingTrade);
  });

  it('kingRingExposure and kingCheckExposure change King exposure independently', () => {
    const board = LivingBoard.fromFen('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
    const baseline = kingExposureThousandths(board, 'w', config);
    expect(
      kingExposureThousandths(
        board,
        'w',
        withOverride({ kingRingExposure: 0 }),
      ),
    ).toBe(config.kingCheckExposure);
    expect(
      kingExposureThousandths(
        board,
        'w',
        withOverride({ kingCheckExposure: 0 }),
      ),
    ).toBe(2 * config.kingRingExposure);
    expect(baseline).toBeGreaterThan(config.kingCheckExposure);
  });

  it('exposure saturates at the risk scale rather than exceeding it', () => {
    const board = LivingBoard.fromFen('4k3/8/8/8/8/8/4r3/4K3 w - - 0 1');
    expect(
      kingExposureThousandths(
        board,
        'w',
        withOverride({ kingRingExposure: 900, kingCheckExposure: 900 }),
      ),
    ).toBe(1000);
  });
});
