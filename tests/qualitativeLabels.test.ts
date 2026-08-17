import { describe, expect, it } from 'vitest';

import {
  firePreviewLabel,
  freeAgentRecruitLabel,
  heatBandWord,
  judgementGapWord,
  moraleBandWord,
  moraleTooltip,
  objectionStrengthWord,
  pieceAccessibleLabel,
  pieceSubject,
  promotionAttainmentLabel,
  rosterPieceLabel,
  sightBandWord,
  traumaBandWord,
  traumaTooltip,
  trustBandWord,
  trustChangeWord,
  witnessCostWord,
} from '../src/ui/qualitativeLabels';

describe('qualitative UI labels', () => {
  it('never renders arithmetic for any trust, morale, or trauma value', () => {
    const labels = [
      ...Array.from({ length: 201 }, (_, index) =>
        pieceAccessibleLabel(
          'Aethelgard',
          'Pawn',
          index - 100,
          Math.min(index, 100),
        ),
      ),
      ...Array.from({ length: 201 }, (_, index) => trustBandWord(index - 100)),
      ...Array.from({ length: 101 }, (_, value) => moraleBandWord(value)),
      ...Array.from({ length: 101 }, (_, value) => traumaBandWord(value)),
      ...Array.from({ length: 101 }, (_, value) => moraleTooltip(value)),
      ...Array.from({ length: 101 }, (_, value) => traumaTooltip(value)),
      ...Array.from({ length: 401 }, (_, index) =>
        trustChangeWord(index - 200),
      ),
      ...Array.from({ length: 201 }, (_, index) =>
        freeAgentRecruitLabel('Aethelgard', 'Pawn', index - 100),
      ),
      ...Array.from({ length: 201 }, (_, index) =>
        rosterPieceLabel('Aethelgard', 'Pawn', index - 100, 'ACTIVE'),
      ),
      ...Array.from({ length: 201 }, (_, index) =>
        firePreviewLabel(index - 100),
      ),
      ...Array.from({ length: 201 }, (_, index) => heatBandWord(index - 100)),
      ...Array.from({ length: 401 }, (_, index) =>
        judgementGapWord(index / 100 - 2),
      ),
      ...Array.from({ length: 401 }, (_, index) =>
        objectionStrengthWord(index / 100),
      ),
      ...Array.from({ length: 20 }, (_, index) => sightBandWord(index)),
      ...Array.from({ length: 401 }, (_, index) =>
        witnessCostWord(index - 200),
      ),
      ...['Pawn', 'Knight', 'Queen'].map(
        (role) => promotionAttainmentLabel(role) ?? '',
      ),
    ];

    expect(labels.every((label) => !/\d/.test(label))).toBe(true);
    expect(pieceAccessibleLabel(undefined, 'Pawn', 0, 50)).toBe(
      'Pawn, wary trust, steady morale',
    );
    expect(pieceSubject(undefined, 'Pawn')).toBe('Pawn');
    expect(pieceSubject('Aethelgard', 'Pawn')).toBe('Aethelgard');
    expect(promotionAttainmentLabel(undefined)).toBeNull();
  });

  it('uses monotone trust, morale, and trauma bands', () => {
    const trustBands = [-100, -1, 0, 39, 40, 100].map(trustBandWord);
    const moraleBands = [0, 39, 40, 69, 70, 100].map(moraleBandWord);
    const traumaBands = [0, 19, 20, 59, 60, 100].map(traumaBandWord);

    expect(trustBands).toEqual([
      'hostile',
      'hostile',
      'wary',
      'wary',
      'loyal',
      'loyal',
    ]);
    expect(moraleBands).toEqual([
      'low',
      'low',
      'steady',
      'steady',
      'strong',
      'strong',
    ]);
    expect(traumaBands).toEqual([
      'clear',
      'clear',
      'strained',
      'strained',
      'wounded',
      'wounded',
    ]);
  });

  it('keeps verdict prose ordered as disagreements and objections grow', () => {
    expect([0, 0.5, 1, 1.5, 2].map(judgementGapWord)).toEqual([
      'the same reading',
      'the same reading',
      'a doubtful reading',
      'a doubtful reading',
      'a wholly different reading',
    ]);
    expect([0, 0.5, 1, 2, 3].map(objectionStrengthWord)).toEqual([
      'barely beyond the limit',
      'barely beyond the limit',
      'clearly beyond the limit',
      'clearly beyond the limit',
      'unthinkable to the piece',
    ]);
    expect([2, 5, 6, 10, 11, 16].map(sightBandWord)).toEqual([
      'short sight',
      'short sight',
      'working sight',
      'working sight',
      'far sight',
      'far sight',
    ]);
  });
});
