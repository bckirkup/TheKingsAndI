import type {
  ActTerminalState,
  CareerOutcome,
  MatchRecord,
} from '../persistence/types';
import { resolveCampaignTerminal } from './campaignPolicy';

export function careerOutcomeForTerminal(
  terminal: ActTerminalState,
): CareerOutcome {
  switch (terminal) {
    case 'victory':
      return 'victory';
    case 'dismissal':
      return 'dismissed';
    case 'rout':
      return 'exhausted';
    case 'checkmate':
    case 'ongoing':
    default:
      return 'ongoing';
  }
}

export function finalizeCampaignIfComplete(input: {
  readonly matches: readonly MatchRecord[];
  readonly campaignTarget: number;
  readonly kingsRemaining: number;
}): {
  readonly terminal: ActTerminalState;
  readonly outcome: CareerOutcome;
} | null {
  if (input.matches.length < input.campaignTarget) return null;

  const terminal = resolveCampaignTerminal(
    input.matches.map((match) => match.result),
    input.kingsRemaining,
    input.matches,
  );
  return {
    terminal,
    outcome: careerOutcomeForTerminal(terminal),
  };
}
