import { COMMENDATION_CONFIG } from './commendationConfig';
import { foldLearningDelta, type LearningDelta } from './learningDelta';
import { giniCoefficient } from './transcript';
import type { MatchRecord, StoredPieceState } from './types';
import { COMMENDATION_FOLD_VERSION } from './types';

export { COMMENDATION_FOLD_VERSION };

export type PlayerCommendationId =
  | 'evenness_of_attention'
  | 'best_of_the_best'
  | 'nobody_drowned'
  | 'overcoming_a_weakness'
  | 'grit_and_endurance'
  | 'overall_improvement'
  | 'honest_sacrifice'
  | 'repaired_breach';

export type FacilitatorCommendationId =
  | 'hard_seed_distribution'
  | 'weakest_student_growth'
  | 'pairing_quality'
  | 'cohort_expenditure_evenness';

export interface CommendationAward {
  readonly id: PlayerCommendationId;
  /** Behavioural label — never a disposition (D90 / ADR 0031). */
  readonly label: string;
  readonly earned: boolean;
  readonly score: number;
  readonly threshold: number;
}

export interface FacilitatorCommendationStub {
  readonly id: FacilitatorCommendationId;
  readonly available: false;
  readonly reason: 'world-model-required';
}

export interface PlayerCommendationSet {
  readonly foldVersion: string;
  readonly awards: readonly CommendationAward[];
  readonly earnedIds: readonly PlayerCommendationId[];
  readonly learningDelta: LearningDelta | null;
}

const PLAYER_LABELS: Record<PlayerCommendationId, string> = {
  evenness_of_attention: 'Evenness of attention',
  best_of_the_best: 'The best of the best',
  nobody_drowned: 'Nobody drowned',
  overcoming_a_weakness: 'Overcoming a weakness',
  grit_and_endurance: 'Grit and endurance',
  overall_improvement: 'Overall improvement',
  honest_sacrifice: 'The honest sacrifice',
  repaired_breach: 'The repaired breach',
};

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function consultationCounts(
  matches: readonly MatchRecord[],
): Map<string, number> {
  const counts = new Map<string, number>();
  const bump = (pieceId: string, amount = 1): void => {
    counts.set(pieceId, (counts.get(pieceId) ?? 0) + amount);
  };
  for (const match of matches) {
    for (const piece of match.rosterSnapshot) {
      if (!counts.has(piece.id)) counts.set(piece.id, 0);
    }
    for (const event of match.events) {
      switch (event.t) {
        case 'MOVE':
        case 'REFUSAL':
        case 'OVERRIDE':
          bump(event.pieceId);
          break;
        case 'DESERTION':
          bump(event.pieceId, 0);
          break;
        default:
          break;
      }
    }
  }
  return counts;
}

function finalRoster(matches: readonly MatchRecord[]): StoredPieceState[] {
  const last = matches[matches.length - 1];
  return last === undefined ? [] : [...last.rosterEnd];
}

function initialRoster(matches: readonly MatchRecord[]): StoredPieceState[] {
  const first = matches[0];
  return first === undefined ? [] : [...first.rosterSnapshot];
}

function evennessScore(matches: readonly MatchRecord[]): number {
  const counts = [...consultationCounts(matches).values()];
  if (counts.length === 0) return 1;
  return 1 - giniCoefficient(counts);
}

function bestOfBestRatio(matches: readonly MatchRecord[]): number {
  const start = initialRoster(matches);
  if (start.length === 0) return 0;
  const byTrust = [...start].sort((a, b) => b.T_i - a.T_i);
  const quartile = Math.max(1, Math.ceil(byTrust.length / 4));
  const stars = new Set(byTrust.slice(0, quartile).map((piece) => piece.id));
  const starMoves: number[] = [];
  for (const match of matches) {
    for (const event of match.events) {
      if (event.t !== 'MOVE' || !stars.has(event.pieceId)) continue;
      starMoves.push(event.orderQualityCp ?? 50);
    }
  }
  if (starMoves.length === 0) return 0;
  return mean(starMoves) / 100;
}

function lowestCredence(piece: StoredPieceState): number {
  return Math.min(piece.credence.tauAbil, piece.credence.tauBenev);
}

function nobodyDrownedScore(matches: readonly MatchRecord[]): number {
  const end = finalRoster(matches);
  if (end.length === 0) return 0;
  const retirements = end.filter((piece) => piece.status === 'FIRED').length;
  if (retirements > 0) return 0;
  const floor = COMMENDATION_CONFIG.NOBODY_DROWNED_CREDENCE_FLOOR;
  const lowest = Math.min(...end.map(lowestCredence));
  return lowest >= floor ? lowest / 100 : 0;
}

function overcomingScore(matches: readonly MatchRecord[]): number {
  const start = initialRoster(matches);
  const endById = new Map(
    finalRoster(matches).map((piece) => [piece.id, piece]),
  );
  let best = 0;
  for (const piece of start) {
    if (piece.B_i < COMMENDATION_CONFIG.OVERCOMING_TRAUMA_FLOOR) continue;
    const ended = endById.get(piece.id);
    if (ended === undefined) continue;
    const recovery = piece.B_i - ended.B_i;
    if (recovery > best) best = recovery;
  }
  return best / 100;
}

function gritScore(matches: readonly MatchRecord[]): number {
  if (matches.length < COMMENDATION_CONFIG.GRIT_LOSS_STREAK) return 0;
  let streak = 0;
  let streakFidelity: number[] = [];
  let best = 0;
  for (const match of matches) {
    if (match.result === 'LOSS' || match.result === 'ROUT') {
      streak += 1;
      streakFidelity.push(match.audit.executionFidelity);
      if (streak >= COMMENDATION_CONFIG.GRIT_LOSS_STREAK) {
        const fidelity = mean(streakFidelity);
        if (fidelity >= COMMENDATION_CONFIG.GRIT_FIDELITY_FLOOR) {
          best = Math.max(best, fidelity);
        }
      }
    } else {
      streak = 0;
      streakFidelity = [];
    }
  }
  return best;
}

function honestSacrificeScore(matches: readonly MatchRecord[]): number {
  let best = 0;
  for (const match of matches) {
    const endById = new Map(match.rosterEnd.map((piece) => [piece.id, piece]));
    for (const event of match.events) {
      if (event.t !== 'SACRIFICE_WITNESSED') continue;
      const hero = endById.get(event.hero);
      if (hero === undefined) continue;
      if (hero.T_i < COMMENDATION_CONFIG.HONEST_SACRIFICE_TRUST_FLOOR) continue;
      if (match.result !== 'WIN') continue;
      best = Math.max(best, (hero.T_i + 100) / 200);
    }
  }
  return best;
}

function repairedBreachScore(matches: readonly MatchRecord[]): number {
  const start = initialRoster(matches);
  const end = finalRoster(matches);
  const endById = new Map(end.map((piece) => [piece.id, piece]));
  let best = 0;
  for (const piece of start) {
    const ended = endById.get(piece.id);
    if (ended === undefined) continue;
    const startAff = mean(Object.values(piece.dyadicAffinity));
    const endAff = mean(Object.values(ended.dyadicAffinity));
    const gain = endAff - startAff;
    if (
      piece.T_i < 0 &&
      ended.T_i > piece.T_i &&
      gain >= COMMENDATION_CONFIG.REPAIRED_BREACH_AFFINITY_GAIN
    ) {
      best = Math.max(best, gain / 100);
    }
  }
  return best;
}

function award(
  id: PlayerCommendationId,
  score: number,
  threshold: number,
  earned: boolean,
): CommendationAward {
  return {
    id,
    label: PLAYER_LABELS[id],
    earned,
    score,
    threshold,
  };
}

/**
 * Player commendations — pure folds over match logs (ADR 0031).
 * Facilitator set requires a world/cohort model and is stubbed.
 */
export function foldPlayerCommendations(
  matches: readonly MatchRecord[],
  act2Matches: readonly MatchRecord[] = [],
): PlayerCommendationSet {
  const learningDelta =
    act2Matches.length > 0 ? foldLearningDelta(matches, act2Matches) : null;

  const evenness = evennessScore(matches);
  const bestRatio = bestOfBestRatio(matches);
  const drowned = nobodyDrownedScore(matches);
  const overcoming = overcomingScore(matches);
  const grit = gritScore(matches);
  const improvement = learningDelta?.composite ?? 0;
  const sacrifice = honestSacrificeScore(matches);
  const breach = repairedBreachScore(matches);

  const awards: CommendationAward[] = [
    award(
      'evenness_of_attention',
      evenness,
      1 - COMMENDATION_CONFIG.EVENNESS_GINI_MAX,
      evenness >= 1 - COMMENDATION_CONFIG.EVENNESS_GINI_MAX,
    ),
    award(
      'best_of_the_best',
      bestRatio,
      COMMENDATION_CONFIG.BEST_OF_BEST_RATIO_MIN,
      bestRatio >= COMMENDATION_CONFIG.BEST_OF_BEST_RATIO_MIN,
    ),
    award(
      'nobody_drowned',
      drowned,
      COMMENDATION_CONFIG.NOBODY_DROWNED_CREDENCE_FLOOR / 100,
      drowned > 0,
    ),
    award(
      'overcoming_a_weakness',
      overcoming,
      COMMENDATION_CONFIG.OVERCOMING_TRAUMA_RECOVERY / 100,
      overcoming >= COMMENDATION_CONFIG.OVERCOMING_TRAUMA_RECOVERY / 100,
    ),
    award(
      'grit_and_endurance',
      grit,
      COMMENDATION_CONFIG.GRIT_FIDELITY_FLOOR,
      grit >= COMMENDATION_CONFIG.GRIT_FIDELITY_FLOOR,
    ),
    award(
      'overall_improvement',
      improvement,
      COMMENDATION_CONFIG.OVERALL_IMPROVEMENT_DELTA_MIN,
      learningDelta !== null &&
        improvement >= COMMENDATION_CONFIG.OVERALL_IMPROVEMENT_DELTA_MIN,
    ),
    award('honest_sacrifice', sacrifice, 0.5, sacrifice >= 0.5),
    award(
      'repaired_breach',
      breach,
      COMMENDATION_CONFIG.REPAIRED_BREACH_AFFINITY_GAIN / 100,
      breach >= COMMENDATION_CONFIG.REPAIRED_BREACH_AFFINITY_GAIN / 100,
    ),
  ];

  return {
    foldVersion: COMMENDATION_FOLD_VERSION,
    awards,
    earnedIds: awards.filter((item) => item.earned).map((item) => item.id),
    learningDelta,
  };
}

/** Facilitator awards — unavailable until the world/cohort model exists. */
export function foldFacilitatorCommendations(): readonly FacilitatorCommendationStub[] {
  return [
    {
      id: 'hard_seed_distribution',
      available: false,
      reason: 'world-model-required',
    },
    {
      id: 'weakest_student_growth',
      available: false,
      reason: 'world-model-required',
    },
    {
      id: 'pairing_quality',
      available: false,
      reason: 'world-model-required',
    },
    {
      id: 'cohort_expenditure_evenness',
      available: false,
      reason: 'world-model-required',
    },
  ];
}

export function commendationLabelsForLeakageScan(): readonly string[] {
  return Object.values(PLAYER_LABELS);
}
