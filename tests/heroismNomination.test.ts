import { describe, expect, it } from 'vitest';

import { HEROISM_CONFIG, heroismNomination } from '../src/orchestration';
import type { EngineAuditEntry } from '../src/engine';
import type { CandidateMoveEvaluation, MatchEvent } from '../src/psychology';

const moveEval: CandidateMoveEvaluation = {
  moveNotation: 'Qh5',
  deltaV_board: -2,
  privateScoreCp: -100,
  vLeaderImplied: 0,
  deltaV_capture: 0,
  P_captured: 0.8,
  peerSafetyDeltas: {},
  promotionProspect: 0,
};

const audit: EngineAuditEntry = {
  ply: 7,
  pieceId: 'w:Q:d1',
  san: 'Qh5',
  preMoveScoreCp: -100,
  scoreCp: 80,
  bestScoreCp: 100,
  preMoveDepth: 16,
  scoreDepth: 8,
  bestScoreDepth: 16,
};

const move: Extract<MatchEvent, { t: 'MOVE' }> = {
  t: 'MOVE',
  ply: 7,
  san: 'Qh5',
  pieceId: audit.pieceId,
  verdict: 'COMPLIANT_EXECUTION',
};

function mutateConfig(key: keyof typeof HEROISM_CONFIG, value: number): void {
  const config = HEROISM_CONFIG as unknown as Record<string, number>;
  config[key] = value;
}

describe('heroism nomination', () => {
  it('golden: records compliant private-blind decisive duty', () => {
    expect(heroismNomination([move], moveEval, audit)).toMatchObject({
      t: 'HEROISM_NOMINATION',
      ply: 7,
      pieceId: 'w:Q:d1',
      san: 'Qh5',
    });
  });

  it('sensitivity: disagreement threshold suppresses the candidate', () => {
    const original = HEROISM_CONFIG.PRIVATE_DISAGREEMENT_THRESHOLD_CP;
    try {
      mutateConfig('PRIVATE_DISAGREEMENT_THRESHOLD_CP', 300);
      expect(heroismNomination([move], moveEval, audit)).toBeUndefined();
    } finally {
      mutateConfig('PRIVATE_DISAGREEMENT_THRESHOLD_CP', original);
    }
  });

  it('sensitivity: decisive threshold suppresses the candidate', () => {
    const original = HEROISM_CONFIG.DECISIVE_MARGIN_CP;
    try {
      mutateConfig('DECISIVE_MARGIN_CP', 300);
      expect(heroismNomination([move], moveEval, audit)).toBeUndefined();
    } finally {
      mutateConfig('DECISIVE_MARGIN_CP', original);
    }
  });

  it('sensitivity: near-best tolerance suppresses a non-near-best act', () => {
    const original = HEROISM_CONFIG.NEAR_BEST_TOLERANCE_CP;
    try {
      mutateConfig('NEAR_BEST_TOLERANCE_CP', 10);
      expect(heroismNomination([move], moveEval, audit)).toBeUndefined();
    } finally {
      mutateConfig('NEAR_BEST_TOLERANCE_CP', original);
    }
  });

  it('does not nominate refusal or override acts', () => {
    const refusal: Extract<MatchEvent, { t: 'REFUSAL' }> = {
      t: 'REFUSAL',
      ply: 7,
      pieceId: audit.pieceId,
      san: audit.san,
      utility: -1,
      threshold: 0,
      perceivedValue: -1,
      privateViewLoss: 1,
      obviousness: 1,
      authorityLoss: 0,
      justified: true,
    };
    expect(heroismNomination([refusal], moveEval, audit)).toBeUndefined();
    expect(
      heroismNomination(
        [
          {
            t: 'OVERRIDE',
            ply: 7,
            pieceId: audit.pieceId,
            san: audit.san,
            pieceTrustDelta: -1,
            vindicated: false,
            implicit: false,
          },
          move,
        ],
        moveEval,
        audit,
      ),
    ).toBeUndefined();
  });
});
