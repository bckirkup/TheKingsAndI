import { describe, expect, it } from 'vitest';

import {
  counselForCandidate,
  counselOpinionValue,
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  type PieceState,
} from '../src/psychology';
import {
  consultWithBudget,
  DRAFT_CONFIG,
  type CounselConsultationRequest,
} from '../src/orchestration';
import { foldCounselMetrics } from '../sim/metrics';

function holder(overrides: Partial<PieceState> = {}): PieceState {
  return normalizePieceState({
    id: 'holder',
    role: 'Knight',
    traits: {
      w_honor: 0.5,
      w_courage: 0.5,
      w_ambition: 0.5,
      w_loyalty: 0.5,
      w_empathy: 0.5,
      w_prestige: 0.5,
    },
    E_i: 40,
    T_i: 50,
    M_i: 70,
    B_i: 0,
    dyadicAffinity: { candidate: 80 },
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

const candidate = {
  id: 'candidate',
  originRole: 'Pawn' as const,
};

describe('private informant counsel', () => {
  it('names affinity and keeps the arithmetic private', () => {
    const statement = counselForCandidate(
      holder({ credence: { ...defaultCredence(), tauBenev: 100 } }),
      candidate,
    );
    expect(statement.opinion).toBe('strongly_recommend');
    expect(statement.reason).toBe('personal affinity');
    expect(statement).not.toHaveProperty('score');
    expect(statement).not.toHaveProperty('tauBenev');
  });

  it('is directly sensitive to damaged credence in the commander', () => {
    const high = counselForCandidate(
      holder({ credence: { ...defaultCredence(), tauBenev: 100 } }),
      candidate,
    );
    const low = counselForCandidate(
      holder({ credence: { ...defaultCredence(), tauBenev: 25 } }),
      candidate,
    );
    expect(counselOpinionValue(high.opinion)).toBeGreaterThan(
      counselOpinionValue(low.opinion),
    );
    expect(high.volunteering).toBe('forthcoming');
    expect(low.volunteering).toBe('reluctant');
    expect(low.reason).toBe('low credence');
    expect(
      counselForCandidate(
        holder({ credence: { ...defaultCredence(), tauBenev: 0 } }),
        candidate,
      ).volunteering,
    ).toBe('silent');
    expect([
      counselOpinionValue('strongly_recommend'),
      counselOpinionValue('recommend'),
      counselOpinionValue('caution'),
      counselOpinionValue('discourage'),
    ]).toEqual([2, 1, 0, -1]);
  });

  it('labels rivalry separately from class prejudice', () => {
    const rivalry = counselForCandidate(
      holder({
        dyadicAffinity: {},
        classPrestige: { ...holder().classPrestige },
      }),
      { ...candidate, originRole: 'Knight' },
    );
    const classBiased = counselForCandidate(
      holder({
        dyadicAffinity: {},
        classPrestige: { ...holder().classPrestige, Pawn: -80 },
      }),
      candidate,
    );
    expect(rivalry.reason).toBe('chair rivalry');
    expect(classBiased.reason).toBe('class prejudice');
  });

  it('names rumour or mixed evidence when those are the leading causes', () => {
    const rumour = counselForCandidate(
      holder({
        dyadicAffinity: {},
        rumor: { ...defaultRumor(), leaderAppraisal: 80 },
        credence: { ...defaultCredence(), tauBenev: 100 },
      }),
      candidate,
    );
    const mixed = counselForCandidate(
      holder({ dyadicAffinity: {} }),
      candidate,
    );
    expect(rumour.reason).toBe('rumour appraisal');
    expect(mixed.opinion).toBe('caution');
    expect(mixed.reason).toBe('mixed evidence');
  });

  it('keeps consultations at zero by default and grades the budget', () => {
    const requests: CounselConsultationRequest[] = [
      { holder: holder(), candidate },
      { holder: holder({ id: 'holder-2' }), candidate },
    ];
    expect(consultWithBudget(requests).granted).toBe(0);
    const counts = [0, 1, 2].map(
      (budget) =>
        consultWithBudget(requests, {
          CONSULTATIONS_PER_CYCLE: budget,
        }).granted,
    );
    expect(counts).toEqual([0, 1, 2]);
    expect(DRAFT_CONFIG.CONSULTATIONS_PER_CYCLE).toBe(0);
  });

  it('folds heeded counsel on the harness side only', () => {
    const metrics = foldCounselMetrics([
      {
        opinion: 'recommend',
        realizedContribution: 2,
        heeded: true,
      },
      {
        opinion: 'caution',
        realizedContribution: 0,
        heeded: false,
      },
    ]);
    expect(metrics).toEqual({
      consultations: 2,
      heeded: 1,
      heededRate: 0.5,
    });
  });
});
