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
  if (results.includes('ROUT')) return 'rout';
  if (results.includes('DISMISSED')) {
    return kingsRemaining <= 0 ? 'dismissal' : 'ongoing';
  }
  if (results.at(-1) === 'WIN') return 'victory';
  if (results.at(-1) === 'LOSS') return 'checkmate';
  return 'ongoing';
}

export const EPILOGUE_BY_TERMINAL: Record<ActTerminalState, string> = {
  ongoing: 'The campaign continues. Your orders still carry weight — for now.',
  checkmate:
    'Outplayed. The roster marched where you pointed, but the positions you chose were losing. The pieces are spent, not shattered: they followed you into defeat.',
  dismissal:
    'Dismissed. The roster survives intact and still wants the win — they lost faith in your judgment, not in the mission. The King took the field; the debrief will show whether the army played better under a worse tactician who was obeyed.',
  rout: 'Rout. The army shattered. Desertion cascaded until only the King remained. This is the worst ending: not merely outplayed, but abandoned.',
  victory:
    'Victory. The army’s realized play sustained above your personal ceiling — the roster executed well enough that the positions themselves carried the campaign. You led beyond your own tactical limit.',
};

/** @deprecated Use EPILOGUE_BY_TERMINAL */
export const EPILOGUE_STUB = EPILOGUE_BY_TERMINAL;
