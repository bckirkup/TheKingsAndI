import epiloguesPack from '../narrative/packs/military/epilogues.json';
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

/** ADR 0022 §6 — dismissal ends two ways, depending on how the successor did. */
export type DismissalReading = 'lost_room' | 'broke_roster';

export interface Epilogue {
  readonly headline: string;
  readonly paragraphs: readonly string[];
}

export interface EpilogueInput {
  readonly terminal: ActTerminalState;
  /** 1-based appointment; absent → the unflavored default. */
  readonly act?: number;
  /** Only consulted when terminal === 'dismissal' (ADR 0022 §6). */
  readonly dismissalReading?: DismissalReading;
}

type EpilogueAct = '1' | '2' | '3';

function epilogueAct(act: number | undefined): EpilogueAct | null {
  if (act === undefined) return null;
  if (act <= 1) return '1';
  if (act >= 3) return '3';
  return '2';
}

export function epilogueFor(input: EpilogueInput): Epilogue {
  const entry = epiloguesPack.terminals[input.terminal];
  if (input.terminal === 'dismissal' && input.dismissalReading !== undefined) {
    return epiloguesPack.terminals.dismissal.readings[input.dismissalReading];
  }
  const act = epilogueAct(input.act);
  if (act !== null && 'acts' in entry) {
    return entry.acts[act];
  }
  return entry.default;
}

function epilogueText(entry: Epilogue): string {
  return `${entry.headline} ${entry.paragraphs.join(' ')}`;
}

/**
 * Compare the matches the King commanded after a dismissal against the ones
 * the player commanded before it (ADR 0022 §6): a successor who scores at
 * least as well means you lost the room; one who scores worse means the roster
 * itself was broken — the worse ending. No post-dismissal matches → undefined.
 */
export function dismissalReadingFor(
  results: readonly {
    readonly result: MatchResult;
    readonly winScore?: number;
  }[],
): DismissalReading | undefined {
  const dismissedAt = results.findIndex(
    (match) => match.result === 'DISMISSED',
  );
  if (dismissedAt < 0) return undefined;
  const successor = results.slice(dismissedAt + 1);
  if (successor.length === 0) return undefined;
  const mine = results.slice(0, dismissedAt + 1);
  const mean = (runs: readonly { readonly winScore?: number }[]): number => {
    const scored = runs.filter((run) => run.winScore !== undefined);
    if (scored.length === 0) return 50;
    return (
      scored.reduce((sum, run) => sum + (run.winScore ?? 50), 0) / scored.length
    );
  };
  return mean(successor) >= mean(mine) ? 'lost_room' : 'broke_roster';
}

export const EPILOGUE_BY_TERMINAL: Record<ActTerminalState, string> = {
  ongoing: epilogueText(epiloguesPack.terminals.ongoing.default),
  checkmate: epilogueText(epiloguesPack.terminals.checkmate.default),
  dismissal: epilogueText(epiloguesPack.terminals.dismissal.default),
  rout: epilogueText(epiloguesPack.terminals.rout.default),
  victory: epilogueText(epiloguesPack.terminals.victory.default),
};

/** @deprecated Use EPILOGUE_BY_TERMINAL */
export const EPILOGUE_STUB = EPILOGUE_BY_TERMINAL;
