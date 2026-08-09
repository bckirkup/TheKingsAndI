import type { PieceState } from '../psychology';

import { CAMPAIGN_CONFIG } from './campaignConfig';
import type {
  MatchResult,
  ActTerminalState,
  DismissalCause,
  StoredPieceState,
} from '../persistence/types';
import { classifyActTerminal } from './terminalState';

export type { DismissalCause };

export function meanRosterTrust(roster: readonly PieceState[]): number {
  if (roster.length === 0) return 0;
  return roster.reduce((sum, piece) => sum + piece.T_i, 0) / roster.length;
}

/** Mandate lost — roster intact but trust collapsed (ADR 0021, D26). */
export function shouldDismissByRoom(roster: readonly PieceState[]): boolean {
  if (roster.length <= 1) return false;
  return meanRosterTrust(roster) <= CAMPAIGN_CONFIG.DISMISSAL_MEAN_TRUST;
}

/**
 * King dismisses on results even when the room still believes (ADR 0024 §3).
 * `kingTauAbil` is the King's independent ability channel in the player.
 */
export function shouldDismissByKing(kingTauAbil: number): boolean {
  return kingTauAbil <= CAMPAIGN_CONFIG.KING_DISMISSAL_TAU_ABIL;
}

export type DismissalDecision =
  | { readonly dismiss: false }
  | { readonly dismiss: true; readonly cause: DismissalCause };

export function evaluateDismissal(
  roster: readonly PieceState[],
  kingTauAbil: number,
): DismissalDecision {
  if (shouldDismissByRoom(roster)) {
    return { dismiss: true, cause: 'dismissed_by_room' };
  }
  if (shouldDismissByKing(kingTauAbil)) {
    return { dismiss: true, cause: 'dismissed_by_king' };
  }
  return { dismiss: false };
}

/** @deprecated Prefer evaluateDismissal — room path only. */
export function shouldDismiss(roster: readonly PieceState[]): boolean {
  return shouldDismissByRoom(roster);
}

/**
 * Update the King's results channel from match realized quality.
 * Winning / high-quality play raises it; collapse lowers it.
 */
export function updateKingTauAbil(
  previous: number,
  realizedQuality: number,
): number {
  const delta = Math.round((realizedQuality - 50) / 5);
  return Math.max(0, Math.min(100, previous + delta));
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

/**
 * Select a successor after dismissal (ADR 0025 §4).
 * Prefer the opposing commander when available; King is the fallback.
 */
export function selectSuccessorLeader(input: {
  readonly rivalLeaderId: string | undefined;
  readonly kingLeaderId: string;
  readonly rivalAvailable: boolean;
}): string {
  if (input.rivalAvailable && input.rivalLeaderId !== undefined) {
    return input.rivalLeaderId;
  }
  return input.kingLeaderId;
}

/** Thin the available roster for a diminished appointment (ADR 0024 §4). */
export function thinRosterForDiminishedAppointment<
  T extends { readonly T_i: number },
>(
  roster: readonly T[],
  cap: number = CAMPAIGN_CONFIG.DIMINISHED_ROSTER_CAP,
): T[] {
  if (roster.length <= cap) return [...roster];
  return [...roster].sort((a, b) => b.T_i - a.T_i).slice(0, cap);
}
