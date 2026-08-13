import { LivingBoard } from '../src/chess';
import { describe, expect, it } from 'vitest';
import {
  endpointFor,
  kingAbandonmentAfterWithdrawals,
} from '../src/orchestration';
import { scoreMatchOutcome } from '../src/orchestration/outcomeScore';

describe('King abandonment', () => {
  it('turns an exposed King into a terminal loss for that side', () => {
    const board = LivingBoard.fromFen('4k3/8/8/8/8/6b1/5p2/4K3 b - - 0 1');

    board.withdrawPiece('b:P:f2');

    const abandonment = kingAbandonmentAfterWithdrawals(board, 'b');

    expect(abandonment).toMatchObject({
      abandonedSide: 'w',
      attackerSide: 'b',
    });
    expect(scoreMatchOutcome(board, 'w', true)).toBe(0);
  });

  it('filters a PV that captures either King', () => {
    const board = LivingBoard.fromFen(
      'r4bnr/2n1p1p1/2N1bp1k/3p3p/8/8/2Q5/2B2BKR w - - 0 22',
    );

    expect(endpointFor(board, ['c1h6'])).toBeUndefined();
  });
});
