import { describe, expect, it } from 'vitest';

import {
  ENGINE_CONFIG,
  applyBetrayalSignal,
  applyOverride,
  applyRepairSignal,
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  witnessAttachmentPermille,
  type PieceState,
} from '../src/psychology';

const neutralTraits = {
  w_honor: 0.5,
  w_courage: 0.5,
  w_ambition: 0.5,
  w_loyalty: 0.5,
  w_empathy: 0.5,
  w_prestige: 0.5,
} as const;

function makePiece(
  id = 'w:N:g1',
  overrides: Partial<PieceState> = {},
): PieceState {
  return normalizePieceState({
    id,
    role: 'Knight',
    traits: neutralTraits,
    E_i: 50,
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

function withConfig<T>(
  values: Readonly<Record<string, number>>,
  run: () => T,
): T {
  const config = ENGINE_CONFIG as unknown as Record<string, number>;
  const originals: Array<[string, number]> = Object.keys(values).map((key) => [
    key,
    config[key] ?? 0,
  ]);
  try {
    for (const [key, value] of Object.entries(values)) {
      config[key] = value;
    }
    return run();
  } finally {
    for (const [key, value] of originals) {
      config[key] = value;
    }
  }
}

describe('D167 curdle floor controls', () => {
  it('keeps the pre-D176 witness behavior at explicit inert settings', () => {
    const target = makePiece('w:N:g1');
    const witness = makePiece('w:B:f1');
    const secondWitness = makePiece('w:P:a2', {
      credence: { ...defaultCredence(), tauBenev: 80 },
    });
    const result = withConfig(
      {
        OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE: 1_000,
        OVERRIDE_STANDING_PRICE_PERMILLE: 0,
      },
      () => applyOverride(target, [witness, secondWitness], 3, 'Nf3'),
    );

    expect(result.overriddenPiece.credence.tauBenev).toBe(38);
    expect(result.overriddenPiece.credence.ruptureDebt).toBe(12);
    expect(result.witnesses[0]?.credence.tauBenev).toBe(38);
    expect(result.witnesses[0]?.credence.ruptureDebt).toBe(12);
    expect(result.witnesses[1]?.credence.tauBenev).toBe(60);
    expect(result.witnesses[1]?.credence.ruptureDebt).toBe(20);
  });

  it('records the measured zero-charge threshold as a graded-price change detector', () => {
    // The threshold is the price of grading, measured rather than promised:
    // the free-insistence metric gate belongs to the magnitude sweep, not here.
    const target = makePiece('w:N:g1');
    const attachedWitness = makePiece('w:B:f1', {
      dyadicAffinity: { [target.id]: 100 },
      classPrestige: {
        Pawn: 0,
        Knight: 100,
        Bishop: 0,
        Rook: 0,
        Queen: 0,
        King: 0,
      },
    });
    const threshold = (multiplier: number, standingPrice: number): number =>
      withConfig(
        {
          OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE: multiplier,
          OVERRIDE_STANDING_PRICE_PERMILLE: standingPrice,
        },
        () => {
          for (let tauBenev = 1; tauBenev <= 100; tauBenev += 1) {
            const witness = makePiece('w:B:f1', {
              dyadicAffinity: attachedWitness.dyadicAffinity,
              classPrestige: attachedWitness.classPrestige,
              credence: { ...defaultCredence(), tauBenev },
            });
            const result = applyOverride(target, [witness], 3, 'Nf3');
            if (
              witness.credence.tauBenev -
                (result.witnesses[0]?.credence.tauBenev ?? 0) >
              0
            ) {
              return tauBenev;
            }
          }
          return 0;
        },
      );

    expect(threshold(1_000, 0)).toBe(4);
    expect(threshold(500, 0)).toBe(8);
    expect(threshold(1_000, 500)).toBe(3);
  });

  it('keeps witness charge monotone in attachment and multiplier without credit', () => {
    const target = makePiece('w:N:g1');
    const witness = (attachment: number, tauBenev = 80): PieceState =>
      makePiece('w:B:f1', {
        dyadicAffinity: { [target.id]: attachment },
        credence: { ...defaultCredence(), tauBenev },
      });
    const drop = (piece: PieceState, multiplier: number): number =>
      withConfig(
        {
          OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE: multiplier,
          OVERRIDE_STANDING_PRICE_PERMILLE: 1_000,
        },
        () => {
          const result = applyOverride(target, [piece], 3, 'Nf3');
          return (
            piece.credence.tauBenev -
            (result.witnesses[0]?.credence.tauBenev ?? 0)
          );
        },
      );
    const byAttachment = [0, 50, 100].map((attachment) =>
      drop(witness(attachment), 1_000),
    );
    const byMultiplier = [0, 500, 1_000, 1_500].map((multiplier) =>
      drop(witness(1_000), multiplier),
    );

    expect(witnessAttachmentPermille(witness(0), target)).toBe(0);
    expect(witnessAttachmentPermille(witness(100), target)).toBe(500);
    expect(
      witnessAttachmentPermille(
        makePiece('w:B:f1', {
          dyadicAffinity: { [target.id]: 100 },
          classPrestige: {
            Pawn: 0,
            Knight: 100,
            Bishop: 0,
            Rook: 0,
            Queen: 0,
            King: 0,
          },
        }),
        target,
      ),
    ).toBe(1_000);
    expect(byAttachment).toEqual([20, 25, 30]);
    expect(byMultiplier).toEqual([0, 15, 30, 45]);
    expect(byAttachment).toEqual([...byAttachment].sort((a, b) => a - b));
    expect(byMultiplier).toEqual([...byMultiplier].sort((a, b) => a - b));
    expect(byAttachment.every((value) => value >= 0)).toBe(true);
    expect(byMultiplier.every((value) => value >= 0)).toBe(true);
    const chargedResult = withConfig(
      {
        OVERRIDE_WITNESS_BENEV_MULTIPLIER_PERMILLE: 1_500,
        OVERRIDE_STANDING_PRICE_PERMILLE: 1_000,
      },
      () => applyOverride(target, [witness(100)], 3, 'Nf3'),
    );
    const chargedWitness = chargedResult.witnesses[0];
    expect(chargedWitness?.credence.ruptureDebt).toBe(
      chargedWitness === undefined
        ? 0
        : witness(100).credence.tauBenev - chargedWitness.credence.tauBenev,
    );
  });

  it('grades witness loss when the cliff is not saturated', () => {
    withConfig(
      {
        BENEV_BETRAYAL_CLIFF_SCALE: 1,
        OVERRIDE_WITNESS_BENEV_CLIFF_INPUT: 1,
      },
      () => {
        const target = makePiece('w:N:g1', {
          credence: { ...defaultCredence(), tauBenev: 100 },
        });
        const witness = makePiece('w:B:f1', {
          credence: { ...defaultCredence(), tauBenev: 100 },
        });
        const result = applyOverride(target, [witness], 3, 'Nf3');
        const targetLoss =
          target.credence.tauBenev - result.overriddenPiece.credence.tauBenev;
        const witnessLoss =
          witness.credence.tauBenev -
          (result.witnesses[0]?.credence.tauBenev ?? 0);

        expect(targetLoss).toBeGreaterThan(witnessLoss);
        expect(witnessLoss).toBeGreaterThan(0);
      },
    );
  });

  it('keeps the default proportional cliff and debt ceiling behavior', () => {
    const before = { ...defaultCredence(), tauBenev: 80, ruptureDebt: 80 };
    const betrayed = applyBetrayalSignal(before, 6);
    expect(betrayed.tauBenev).toBe(60);
    expect(betrayed.ruptureDebt).toBe(100);

    withConfig({ BENEV_REPAIR_STEP: 10 }, () => {
      expect(applyRepairSignal(betrayed).credence.ruptureDebt).toBe(90);
    });
  });

  it('makes successive nonzero-permille losses geometric and bounded', () => {
    withConfig({ BENEV_BETRAYAL_CLIFF_PERMILLE: 500 }, () => {
      const before = { ...defaultCredence(), tauBenev: 100 };
      const first = applyBetrayalSignal(before, 6);
      const second = applyBetrayalSignal(first, 6);
      const third = applyBetrayalSignal(second, 6);
      const losses = [
        before.tauBenev - first.tauBenev,
        first.tauBenev - second.tauBenev,
        second.tauBenev - third.tauBenev,
      ];

      expect(losses).toEqual([50, 25, 12]);
      expect(losses[0]).toBeGreaterThan(losses[1] ?? 0);
      expect(losses[1]).toBeGreaterThan(losses[2] ?? 0);
      expect(third.tauBenev).toBeGreaterThanOrEqual(0);
      expect(third.ruptureDebt).toBeLessThanOrEqual(100);
    });

    withConfig({ BENEV_BETRAYAL_CLIFF_PERMILLE: 1_000 }, () => {
      const before = { ...defaultCredence(), tauBenev: 1 };
      const after = applyBetrayalSignal(before, 6);
      expect(before.tauBenev - after.tauBenev).toBeGreaterThan(0);
      expect(after.tauBenev).toBe(0);
    });
  });

  it('keeps benevolence decreasing across repeated overrides', () => {
    withConfig({ BENEV_BETRAYAL_CLIFF_PERMILLE: 500 }, () => {
      let piece = makePiece('w:N:g1', {
        credence: { ...defaultCredence(), tauBenev: 100 },
      });
      const values: number[] = [];
      for (let index = 0; index < 3; index += 1) {
        piece = applyOverride(piece, [], index + 1, 'Nf3').overriddenPiece;
        values.push(piece.credence.tauBenev);
      }

      expect(values).toEqual([50, 25, 13]);
      expect(values[0]).toBeGreaterThan(values[1] ?? 0);
      expect(values[1]).toBeGreaterThan(values[2] ?? 0);
    });
  });

  it('holds the ruled D175 asymptote where the charge truncates to zero', () => {
    // D175: the truncating asymptote is ruled behavior, accepted 2026-08-29.
    // This change detector guards it against silent drift.
    const before = { ...defaultCredence(), tauBenev: 3 };
    const first = applyBetrayalSignal(before, 6);
    const second = applyBetrayalSignal(first, 6);

    expect(first.tauBenev).toBe(3);
    expect(first.ruptureDebt).toBe(0);
    expect(second.tauBenev).toBe(3);
    expect(second.ruptureDebt).toBe(0);
  });

  it('allows rupture debt to accrue above the historical ceiling', () => {
    withConfig(
      { BENEV_RUPTURE_DEBT_CEILING: 250, BENEV_BETRAYAL_CLIFF_PERMILLE: 0 },
      () => {
        const before = { ...defaultCredence(), tauBenev: 0, ruptureDebt: 240 };
        const betrayed = applyBetrayalSignal(before, 6);
        expect(betrayed.ruptureDebt).toBe(250);
        expect(Number.isInteger(betrayed.ruptureDebt)).toBe(true);

        withConfig({ BENEV_REPAIR_STEP: 10 }, () => {
          const repaired = applyRepairSignal({
            ...betrayed,
            ruptureDebt: 150,
          });
          expect(repaired.credence.ruptureDebt).toBe(140);
        });
      },
    );
  });

  it('keeps normalized debt inside the configured ceiling', () => {
    withConfig({ BENEV_RUPTURE_DEBT_CEILING: 250 }, () => {
      const piece = makePiece('w:N:g1', {
        credence: { ...defaultCredence(), ruptureDebt: 300 },
      });
      expect(piece.credence.ruptureDebt).toBe(250);
      expect(piece.credence.ruptureDebt).toBeGreaterThanOrEqual(0);
    });
  });
});
