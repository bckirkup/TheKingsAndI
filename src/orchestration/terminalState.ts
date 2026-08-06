import type { MatchResult, ActTerminalState } from '../persistence/types';

export function classifyMatchResult(input: {
  readonly rout: boolean;
  readonly winScore: number;
  readonly dismissed: boolean;
}): MatchResult {
  if (input.dismissed) return 'DISMISSED';
  if (input.rout) return 'ROUT';
  if (input.winScore >= 100) return 'WIN';
  if (input.winScore <= 0) return 'LOSS';
  return 'DRAW';
}

export function classifyActTerminal(
  results: readonly MatchResult[],
  kingsRemaining: number,
): ActTerminalState {
  if (results.some((result) => result === 'ROUT')) return 'rout';
  if (results.some((result) => result === 'DISMISSED')) {
    return kingsRemaining <= 0 ? 'dismissal' : 'ongoing';
  }
  if (results.at(-1) === 'WIN') return 'victory';
  if (results.at(-1) === 'LOSS') return 'checkmate';
  return 'ongoing';
}

export const EPILOGUE_STUB: Record<ActTerminalState, string> = {
  ongoing: 'The campaign continues.',
  checkmate: 'Outplayed — the roster is spent but intact.',
  dismissal:
    'Dismissed — the roster survives and the King takes the field (ADR 0022).',
  rout: 'Rout — the army shattered.',
  victory: 'The army exceeded the commander’s ceiling (ADR 0023).',
};
