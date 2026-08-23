import { describe, expect, it } from 'vitest';

import {
  counselForCandidate,
  counselOpinionValue,
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  type CounselOpinion,
  type PieceCounsel,
  type PieceState,
} from '../src/psychology';
import {
  consultWithBudget,
  DRAFT_CONFIG,
  type CounselConsultationRequest,
  type DraftConfig,
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

function spokenOpinion(counsel: PieceCounsel): CounselOpinion {
  if (!('opinion' in counsel)) throw new Error('expected spoken counsel');
  return counsel.opinion;
}

function spokenCounsel(counsel: PieceCounsel) {
  if (!('opinion' in counsel)) throw new Error('expected spoken counsel');
  return counsel;
}

describe('private informant counsel', () => {
  it('names affinity and keeps the arithmetic private', () => {
    const statement = counselForCandidate(
      holder({ credence: { ...defaultCredence(), tauBenev: 100 } }),
      candidate,
    );
    expect(spokenOpinion(statement)).toBe('strongly_recommend');
    expect(spokenCounsel(statement).reason).toBe('personal affinity');
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
    expect(counselOpinionValue(spokenOpinion(high))).toBe(
      counselOpinionValue(spokenOpinion(low)),
    );
    expect(high.volunteering).toBe('forthcoming');
    expect(low.volunteering).toBe('reluctant');
    const silent = counselForCandidate(
      holder({ credence: { ...defaultCredence(), tauBenev: 0 } }),
      candidate,
    );
    expect(silent).toEqual({ volunteering: 'silent' });
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
    expect(spokenCounsel(rivalry).reason).toBe('chair rivalry');
    expect(spokenCounsel(classBiased).reason).toBe('class prejudice');
  });

  it('names mixed evidence when affinity and class evidence are absent', () => {
    const mixed = counselForCandidate(
      holder({ dyadicAffinity: {} }),
      candidate,
    );
    expect(spokenOpinion(mixed)).toBe('caution');
    expect(spokenCounsel(mixed).reason).toBe('mixed evidence');
  });

  it('does not substitute the holder appraisal for candidate rumour', () => {
    const withoutRumour = counselForCandidate(
      holder({ dyadicAffinity: {} }),
      candidate,
    );
    const withLeaderAppraisal = counselForCandidate(
      holder({
        dyadicAffinity: {},
        rumor: { ...holder().rumor, leaderAppraisal: 100 },
      }),
      candidate,
    );
    expect(withLeaderAppraisal).toEqual(withoutRumour);
  });

  it('uses origin-inclusive eligibility for a promoted candidate', () => {
    const rivalry = counselForCandidate(
      holder({ dyadicAffinity: {}, role: 'Pawn' }),
      { ...candidate, attainedRole: 'Pawn' },
    );
    expect(spokenCounsel(rivalry).reason).toBe('chair rivalry');
  });

  it('uses origin-inclusive eligibility for a promoted holder', () => {
    const rivalry = counselForCandidate(
      holder({ dyadicAffinity: {}, role: 'Knight' }),
      candidate,
      DRAFT_CONFIG,
      'Pawn',
    );
    expect(spokenCounsel(rivalry).reason).toBe('chair rivalry');
  });

  it('wires each counsel magnitude as a live draft search seed', () => {
    const opinionValue = (config: DraftConfig) =>
      counselOpinionValue(
        spokenOpinion(
          counselForCandidate(holder({ role: 'Pawn' }), candidate, config),
        ),
      );
    expect(
      [0, 40, 80].map((penalty) =>
        opinionValue({
          ...DRAFT_CONFIG,
          COUNSEL_RIVALRY_PENALTY: penalty,
        }),
      ),
    ).toEqual([2, 1, 0]);

    const nonRival = (config: DraftConfig) =>
      counselOpinionValue(
        spokenOpinion(
          counselForCandidate(
            holder({ dyadicAffinity: { candidate: 40 } }),
            candidate,
            config,
          ),
        ),
      );
    expect(
      [20, 40, 60].map((threshold) =>
        nonRival({
          ...DRAFT_CONFIG,
          COUNSEL_STRONGLY_RECOMMEND_THRESHOLD: threshold,
        }),
      ),
    ).toEqual([2, 2, 1]);
    expect(
      [0, 30, 70].map((threshold) =>
        nonRival({
          ...DRAFT_CONFIG,
          COUNSEL_RECOMMEND_THRESHOLD: threshold,
        }),
      ),
    ).toEqual([1, 1, 0]);
    expect(
      [-30, -20, 10].map((threshold) =>
        counselOpinionValue(
          spokenOpinion(
            counselForCandidate(holder({ dyadicAffinity: {} }), candidate, {
              ...DRAFT_CONFIG,
              COUNSEL_CAUTION_THRESHOLD: threshold,
            }),
          ),
        ),
      ),
    ).toEqual([0, 0, -1]);

    const volunteeringValue = (config: DraftConfig, tauBenev: number) =>
      ({
        silent: 0,
        reluctant: 1,
        guarded: 2,
        forthcoming: 3,
      })[
        counselForCandidate(
          holder({ credence: { ...defaultCredence(), tauBenev } }),
          candidate,
          config,
        ).volunteering
      ];
    expect(
      [40, 75, 90].map((threshold) =>
        volunteeringValue(
          {
            ...DRAFT_CONFIG,
            COUNSEL_FORTHCOMING_CREDENCE: threshold,
          },
          80,
        ),
      ),
    ).toEqual([3, 3, 2]);
    expect(
      [30, 50, 90].map((threshold) =>
        volunteeringValue(
          {
            ...DRAFT_CONFIG,
            COUNSEL_GUARDED_CREDENCE: threshold,
          },
          60,
        ),
      ),
    ).toEqual([2, 2, 1]);
    expect(
      [10, 25, 70].map((threshold) =>
        volunteeringValue(
          {
            ...DRAFT_CONFIG,
            COUNSEL_RELUCTANT_CREDENCE: threshold,
          },
          40,
        ),
      ),
    ).toEqual([1, 1, 0]);
  });

  it('keeps consultations at zero by default and grades the budget', () => {
    const requests: CounselConsultationRequest[] = [
      {
        holder: holder({ dyadicAffinity: {} }),
        holderOriginRole: 'Pawn',
        candidate,
      },
      { holder: holder({ id: 'holder-2' }), candidate },
    ];
    expect(consultWithBudget(requests).granted).toBe(0);
    const counts = [0, 1, 2].map(
      (budget) =>
        consultWithBudget(requests, {
          ...DRAFT_CONFIG,
          CONSULTATIONS_PER_CYCLE: budget,
        }).granted,
    );
    expect(counts).toEqual([0, 1, 2]);
    expect(DRAFT_CONFIG.CONSULTATIONS_PER_CYCLE).toBe(0);
    const granted = consultWithBudget(requests, {
      ...DRAFT_CONFIG,
      CONSULTATIONS_PER_CYCLE: 1,
    }).consultations[0];
    if (granted === undefined) throw new Error('expected granted consultation');
    expect(spokenCounsel(granted.counsel).reason).toBe('chair rivalry');
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
