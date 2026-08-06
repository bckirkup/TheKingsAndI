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

/** Career victory: realized position quality sustained above player ceiling (5.10, ADR 0023). */
export function evaluateCareerVictory(
  matches: readonly { readonly audit: { readonly realizedQuality: number } }[],
): boolean {
  const threshold = CAMPAIGN_CONFIG.VICTORY_REALIZED_QUALITY;
  const needed = CAMPAIGN_CONFIG.VICTORY_SUSTAINED_MATCHES;
  if (matches.length < needed) return false;
  const tail = matches.slice(-needed);
  return tail.every((match) => match.audit.realizedQuality >= threshold);
}

export function resolveCampaignTerminal(
  results: readonly MatchResult[],
  kingsRemaining: number,
  matches: readonly { readonly audit: { readonly realizedQuality: number } }[],
): ActTerminalState {
  if (results.some((result) => result === 'ROUT')) return 'rout';
  if (results.some((result) => result === 'DISMISSED') && kingsRemaining <= 0) {
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

/** Reinstatement available when roster trust recovers after dismissal (ADR 0022 §7). */
export function evaluateReinstatement(
  roster: readonly PieceState[],
  lastMatchMeanTrustDelta: number,
): boolean {
  if (roster.length === 0) return false;
  const meanTrust = meanRosterTrust(roster);
  return (
    meanTrust > CAMPAIGN_CONFIG.REINSTATEMENT_TRUST_FLOOR &&
    lastMatchMeanTrustDelta > CAMPAIGN_CONFIG.REINSTATEMENT_TRUST_RECOVERY
  );
}

export function leaderAbilityTrustFromMatches(
  matches: readonly { readonly audit: { readonly realizedQuality: number } }[],
): number {
  if (matches.length === 0) return 50;
  const recent = matches.slice(-3);
  return Math.round(
    recent.reduce((sum, match) => sum + match.audit.realizedQuality, 0) /
      recent.length,
  );
}

export function rosterBenevolenceAppraisal(
  roster: readonly PieceState[],
): number {
  if (roster.length === 0) return 50;
  return Math.round(
    roster.reduce((sum, piece) => sum + piece.credence.tauBenev, 0) /
      roster.length,
  );
}
