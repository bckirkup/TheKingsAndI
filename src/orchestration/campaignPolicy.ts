import type { PieceState } from '../psychology';

import { CAMPAIGN_CONFIG } from './campaignConfig';
import type {
  MatchResult,
  ActTerminalState,
  StoredPieceState,
} from '../persistence/types';
import { classifyActTerminal } from './terminalState';

export function meanRosterTrust(roster: readonly PieceState[]): number {
  if (roster.length === 0) return 0;
  return roster.reduce((sum, piece) => sum + piece.T_i, 0) / roster.length;
}

/** Mandate lost — roster intact but trust collapsed (ADR 0021, D26). */
export function shouldDismiss(roster: readonly PieceState[]): boolean {
  if (roster.length <= 1) return false;
  return meanRosterTrust(roster) <= CAMPAIGN_CONFIG.DISMISSAL_MEAN_TRUST;
}

/** Career victory: sustained board quality above player ceiling (5.10, ADR 0023). */
export function evaluateCareerVictory(
  matches: readonly { readonly audit: { readonly boardQuality: number } }[],
): boolean {
  const threshold = CAMPAIGN_CONFIG.VICTORY_BOARD_QUALITY;
  const needed = CAMPAIGN_CONFIG.VICTORY_SUSTAINED_MATCHES;
  if (matches.length < needed) return false;
  const tail = matches.slice(-needed);
  return tail.every((match) => match.audit.boardQuality >= threshold);
}

export function resolveCampaignTerminal(
  results: readonly MatchResult[],
  kingsRemaining: number,
  matches: readonly { readonly audit: { readonly boardQuality: number } }[],
): ActTerminalState {
  if (results.some((result) => result === 'ROUT')) return 'rout';
  if (
    results.some((result) => result === 'DISMISSED') &&
    kingsRemaining <= 0
  ) {
    return 'dismissal';
  }
  if (evaluateCareerVictory(matches)) return 'victory';
  return classifyActTerminal(results, kingsRemaining);
}

export function rosterLaunderingRisk(
  incoming: readonly StoredPieceState[],
  benchDepth: number,
): boolean {
  const highTrustRecruits = incoming.filter((piece) => piece.T_i > 70).length;
  return benchDepth >= 24 && highTrustRecruits > benchDepth / 2;
}

/** τ_abil from leader record, τ_benev from roster rumor (5.9 stub). */
export function applyReputationTransfer(
  piece: StoredPieceState,
  leaderAbilityTrust: number,
  rosterBenevolenceAppraisal: number,
): StoredPieceState {
  return {
    ...piece,
    credence: {
      ...piece.credence,
      tauAbil: Math.round((piece.credence.tauAbil + leaderAbilityTrust) / 2),
      tauBenev: Math.round(
        (piece.credence.tauBenev + rosterBenevolenceAppraisal) / 2,
      ),
    },
  };
}
