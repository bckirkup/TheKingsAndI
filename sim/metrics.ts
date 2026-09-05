import type { PieceId } from '../src/chess';
import {
  counselOpinionValue,
  calculateSingleMatchLeadershipIndex,
  ENGINE_CONFIG,
  foldUnjustifiedTrauma,
  type CounselOpinion,
  type MatchEvent,
} from '../src/psychology';
import type { HeadlessMatchResult } from '../src/orchestration';

import type { Leader } from './cli';
import {
  meanClassContempt,
  meanTauAbil,
  meanTauBenev,
  meanTrust,
} from './roster';

export { foldUnjustifiedTrauma };

export type LeadershipArchetype =
  | 'tyrant'
  | 'caretaker'
  | 'chaotic'
  | 'tactician'
  | 'redeemer_arc'
  | 'mixed';

export interface MatchMetrics {
  readonly match: number;
  readonly seed: number;
  readonly leader: Leader;
  readonly plies: number;
  readonly refusals: number;
  readonly overrides: number;
  readonly freeOverrideCount?: number;
  readonly benevLossTarget?: number;
  readonly benevLossWitness?: number;
  readonly freeInsistencePlyFraction?: number;
  readonly implicitOverrides: number;
  readonly quietQuitMoves: number;
  readonly desertions: number;
  readonly promotions: number;
  readonly promotionToRoleCounts: Readonly<Record<string, number>>;
  readonly winningPositionDesertions: number;
  readonly cascadeLength: number;
  readonly firstDeparture: DesertionSummary;
  readonly cascadeDeparture: DesertionSummary;
  readonly refusedGoodMoves: number;
  readonly abilityObservations?: number;
  readonly vindicatedAbilityObservations?: number;
  readonly vindicationRate?: number;
  readonly dripEvents?: number;
  readonly regardEvents?: number;
  readonly shameExposures?: number;
  readonly griefMournings?: number;
  readonly bitternessFormations?: number;
  readonly meanGriefLoadEnd?: number;
  readonly meanBitternessEnd?: number;
  readonly adjudicationObservations?: number;
  readonly adjudicationVindicationRate?: number;
  readonly dripGainTotal?: number;
  readonly regardGainTotal?: number;
  readonly adjudicationLossTotal?: number;
  readonly meanAdjudicationLoss?: number;
  readonly finalTauAbilByRole?: Readonly<Record<string, number>>;
  readonly fieldedPieceIds: readonly PieceId[];
  readonly fieldedCareerIds?: readonly string[];
  readonly desertedPieceIds: readonly PieceId[];
  readonly refusalRate: number;
  readonly refusalsPerPly: number;
  readonly quietQuitRate: number;
  readonly refusedGoodMoveRate: number;
  readonly overrideRate: number;
  readonly meanTrustStart: number;
  readonly meanTrustEnd: number;
  readonly meanTrustFinal: number;
  readonly meanTauAbilStart: number;
  readonly meanTauAbilEnd: number;
  readonly meanTauBenevStart: number;
  readonly meanTauBenevEnd: number;
  readonly classContemptStart: number;
  readonly classContemptEnd: number;
  readonly survivingRosterSize: number;
  readonly enemyAttrition: number;
  readonly enemyFieldedPieceIds: readonly PieceId[];
  readonly enemyFieldedCareerIds?: readonly string[];
  readonly enemySurvivingRosterSize: number;
  readonly enemyDesertions: number;
  readonly enemyDesertedPieceIds: readonly PieceId[];
  readonly retirements?: number;
  readonly retiredCareerIds?: readonly string[];
  readonly graceEvents?: number;
  readonly graceCareerIds?: readonly string[];
  readonly enemyRetirements?: number;
  readonly enemyRetiredCareerIds?: readonly string[];
  readonly enemyGraceEvents?: number;
  readonly enemyGraceCareerIds?: readonly string[];
  readonly enemyRefusalRate: number;
  readonly winScore: number;
  readonly unjustifiedTrauma: number;
  readonly emptiedChairs: number;
  readonly emptiedChairsScore: number;
  readonly leadershipIndex: number;
  readonly rout: boolean;
  readonly dismissed: boolean;
  readonly dismissalCause: string | null;
  readonly dismissalPly: number | null;
  readonly archetype: LeadershipArchetype;
  readonly passedOverDistribution?: Readonly<Record<string, number>>;
  readonly enemyPassedOverDistribution?: Readonly<Record<string, number>>;
  readonly obsolescenceCount?: number;
  readonly enemyObsolescenceCount?: number;
  readonly abilityMin?: number;
  readonly abilityMax?: number;
  readonly meanAbility?: number;
  /** Number of fielded pieces with a nonzero ability grade during this match. */
  readonly abilityMovedCount?: number;
}

export interface CounselObservation {
  readonly opinion: CounselOpinion;
  readonly realizedContribution: number;
  readonly heeded: boolean;
}

export interface CounselMetrics {
  readonly consultations: number;
  readonly heeded: number;
  readonly heededRate: number;
}

/** Fold counsel outcomes into harness-only telemetry; nothing is persisted. */
export function foldCounselMetrics(
  observations: readonly CounselObservation[],
): CounselMetrics {
  const heeded = observations.filter(
    (observation) => observation.heeded,
  ).length;
  return {
    consultations: observations.length,
    heeded,
    heededRate: heeded / Math.max(1, observations.length),
  };
}

/** Numeric counsel signal used only by the harness correlation detectors. */
export function counselSignal(observation: CounselObservation): number {
  return counselOpinionValue(observation.opinion);
}

export interface DesertionSummary {
  readonly count: number;
  readonly unknownCauseCount: number;
  readonly meanUStay: number;
  readonly meanUDesert: number;
  readonly meanPCaptured: number;
  readonly meanPain: number;
  readonly meanPLossIfStay: number;
  readonly meanPLossIfLeave: number;
  readonly meanLambda: number;
  readonly meanLambdaTrust: number;
  readonly meanLambdaMorale: number;
  readonly meanLambdaLoyalty: number;
  readonly meanLambdaAffinity: number;
  readonly meanStandingCost: number;
  readonly meanAttachment: number;
  readonly meanPivotality: number;
  readonly meanPCapturedPain: number;
  readonly meanCollectiveTerm: number;
  readonly attachmentByRole: Readonly<Record<string, number>>;
  readonly pivotalityByRole: Readonly<Record<string, number>>;
  readonly meanGloryWeight: number;
  readonly meanTauBenev: number;
  readonly meanTauAbil: number;
}

export const EMPTY_DESERTION_SUMMARY: DesertionSummary = {
  count: 0,
  unknownCauseCount: 0,
  meanUStay: 0,
  meanUDesert: 0,
  meanPCaptured: 0,
  meanPain: 0,
  meanPLossIfStay: 0,
  meanPLossIfLeave: 0,
  meanLambda: 0,
  meanLambdaTrust: 0,
  meanLambdaMorale: 0,
  meanLambdaLoyalty: 0,
  meanLambdaAffinity: 0,
  meanStandingCost: 0,
  meanAttachment: 0,
  meanPivotality: 0,
  meanPCapturedPain: 0,
  meanCollectiveTerm: 0,
  attachmentByRole: {},
  pivotalityByRole: {},
  meanGloryWeight: 0,
  meanTauBenev: 0,
  meanTauAbil: 0,
};

export interface TrustTrajectoryBin {
  readonly match: number;
  readonly meanTrustEnd: number;
}

export type Quartile = 1 | 2 | 3 | 4;

export interface CampaignTrajectoryBand {
  readonly quartile: Quartile;
  readonly startMatch: number;
  readonly endMatch: number;
  readonly matches: number;
  readonly meanTauAbil: number;
  readonly meanTauBenev: number;
  readonly meanRefusalRate: number;
  readonly meanRefusalsPerPly: number;
  readonly meanVindicationRate: number;
  readonly meanDripEvents: number;
  readonly meanAdjudicationVindicationRate: number;
  readonly meanFinalTauAbilByRole: Readonly<Record<string, number>>;
  readonly desertionMatchRate: number;
  readonly desertionAttrition: number;
  readonly routRate: number;
  readonly meanSurvivingRosterSize: number;
  readonly enemyDesertionAttrition: number;
  readonly meanEnemySurvivingRosterSize: number;
  readonly meanEnemyDesertions: number;
  readonly meanEnemyRefusalRate: number;
  readonly meanAttritionDifferential: number;
  readonly meanSurvivingRosterDifferential: number;
  readonly meanDesertionDifferential: number;
  readonly meanRefusalRateDifferential: number;
  readonly meanWinScore: number;
}

export interface CampaignHorizon {
  readonly horizon: number;
  readonly meanWinScore: number;
  readonly winCount: number;
  readonly drawCount: number;
  readonly lossCount: number;
  readonly winRate: number;
  readonly drawRate: number;
  readonly lossRate: number;
  readonly routRate: number;
  readonly meanRefusalRate: number;
  readonly meanRefusalsPerPly: number;
  readonly desertionMatchRate: number;
  readonly desertionAttrition: number;
  readonly meanDesertions: number;
  readonly meanSurvivingRosterSize: number;
  readonly enemyDesertionAttrition: number;
  readonly meanEnemySurvivingRosterSize: number;
  readonly meanEnemyDesertions: number;
  readonly meanEnemyRefusalRate: number;
  readonly attritionDifferential: number;
  readonly survivingRosterDifferential: number;
  readonly desertionDifferential: number;
  readonly refusalRateDifferential: number;
  readonly meanTauAbil: number;
  readonly meanTauBenev: number;
  readonly meanTrustEnd: number;
}

export interface ControlHorizon {
  readonly horizon: number;
  readonly meanWinScore: number;
  readonly winRate: number;
  readonly drawRate: number;
  readonly lossRate: number;
}

export interface PerRoleCultureMetric {
  readonly role: string;
  readonly meanContemptEnd: number;
}

export interface CampaignMetrics {
  readonly leader: Leader;
  readonly seed: number;
  readonly matches: number;
  readonly matchMetrics: readonly MatchMetrics[];
  readonly desertionMatchRate: number;
  readonly desertionAttrition: number;
  readonly winningPositionDesertionRate: number;
  readonly routCampaignRate: number;
  readonly meanRefusalRate: number;
  readonly meanRefusalsPerPly: number;
  readonly meanQuietQuitRate: number;
  readonly meanRefusedGoodMoveRate: number;
  readonly meanOverrideRate: number;
  readonly meanOverrideCount: number;
  readonly meanFreeOverrideCount: number;
  readonly meanBenevLossTarget: number;
  readonly meanBenevLossWitness: number;
  readonly meanFreeInsistencePlyFraction: number;
  readonly meanPlies: number;
  readonly winCount: number;
  readonly drawCount: number;
  readonly lossCount: number;
  readonly meanPromotionsPerMatch: number;
  readonly promotionMatchRate: number;
  readonly promotionToRoleCounts: Readonly<Record<string, number>>;
  readonly meanWinScore: number;
  readonly meanUnjustifiedTrauma: number;
  readonly meanEmptiedChairs: number;
  readonly meanEmptiedChairsScore: number;
  readonly meanLeadershipIndex: number;
  readonly meanTrustFinal: number;
  readonly meanDesertions: number;
  readonly meanRetirements: number;
  readonly meanGraceEvents: number;
  readonly meanSurvivingRosterSize: number;
  readonly enemyDesertionAttrition: number;
  readonly meanEnemySurvivingRosterSize: number;
  readonly meanEnemyDesertions: number;
  readonly meanEnemyRetirements: number;
  readonly meanEnemyGraceEvents: number;
  readonly meanEnemyRefusalRate: number;
  readonly meanAttritionDifferential: number;
  readonly meanSurvivingRosterDifferential: number;
  readonly meanDesertionDifferential: number;
  readonly meanRefusalRateDifferential: number;
  readonly meanTauAbil: number;
  readonly meanDripGainTotal: number;
  readonly meanRegardEvents: number;
  readonly meanRegardGainTotal: number;
  readonly meanShameExposures: number;
  readonly meanGriefMournings: number;
  readonly meanBitternessFormations: number;
  readonly meanGriefLoadEnd: number;
  readonly meanBitternessEnd: number;
  readonly meanAdjudicationLoss: number;
  readonly meanTauBenev: number;
  readonly abilityMin: number;
  readonly abilityMax: number;
  readonly meanAbility: number;
  readonly abilityMovedCount: number;
  readonly meanTrustEnd: number;
  readonly meanTrustDelta: number;
  readonly classContemptDelta: number;
  /** Per-match mean trust at end — distribution over the campaign (3.3). */
  readonly trustTrajectory: readonly TrustTrajectoryBin[];
  /** Mean class contempt by role across the final match of the campaign. */
  readonly perRoleCulture: readonly PerRoleCultureMetric[];
  readonly trajectoryBands: readonly CampaignTrajectoryBand[];
  readonly horizon: readonly CampaignHorizon[];
}

const CSV_HEADER =
  'match,seed,leader,plies,refusals,overrides,implicit_overrides,quiet_quit_moves,desertions,promotions,promotion_to_role_counts,first_desertions,first_unknown_cause,cascade_desertions,cascade_unknown_cause,cascade_length,first_u_stay,first_u_desert,first_p_captured,first_pain,first_p_loss_if_stay,first_p_loss_if_leave,first_lambda,first_lambda_trust,first_lambda_morale,first_lambda_loyalty,first_lambda_affinity,first_standing_cost,first_glory_weight,first_tau_benev,first_tau_abil,refused_good_moves,refusal_rate,refusals_per_ply,quiet_quit_rate,refused_good_move_rate,override_rate,mean_trust_start,mean_trust_end,class_contempt_start,class_contempt_end,win_score,rout,archetype,mean_tau_abil_start,mean_tau_abil_end,mean_tau_benev_start,mean_tau_benev_end,surviving_roster_size,enemy_attrition,enemy_surviving_roster_size,enemy_desertions,enemy_refusal_rate,retirements,grace_events,enemy_retirements,enemy_grace_events,drip_events,drip_gain_total,regard_events,regard_gain_total,free_override_count,benev_loss_target,benev_loss_witness,free_insistence_ply_fraction,unjustified_trauma,leadership_index,mean_trust_final,emptied_chairs,emptied_chairs_score,dismissed,dismissal_cause,dismissal_ply,shame_exposures,grief_mournings,bitterness_formations,mean_grief_load_end,mean_bitterness_end';

export function calculateEmptiedChairsScore(
  emptiedChairs: number,
  fieldedRosterSize: number,
): number {
  return Math.max(
    0,
    Math.min(100, (100 * emptiedChairs) / Math.max(1, fieldedRosterSize)),
  );
}

/** RFC 4180 quoting: a field containing a comma, quote, or newline is quoted. */
export function csvField(value: string | number): string {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function countEvents(
  events: readonly MatchEvent[],
  fieldedPieceIds: readonly PieceId[],
  plies: number,
): {
  refusals: number;
  overrides: number;
  implicitOverrides: number;
  quietQuitMoves: number;
  desertions: number;
  promotions: number;
  promotionToRoleCounts: Readonly<Record<string, number>>;
  executedOrders: number;
  orderTerminatedDesertionPlies: number;
  abilityObservations: number;
  vindicatedAbilityObservations: number;
  dripEvents: number;
  dripGainTotal: number;
  regardEvents: number;
  regardGainTotal: number;
  shameExposures: number;
  griefMournings: number;
  bitternessFormations: number;
  freeOverrideCount: number;
  benevLossTarget: number;
  benevLossWitness: number;
  freeInsistencePlyFraction: number;
  adjudicationLossTotal: number;
  desertedPieceIds: ReadonlySet<PieceId>;
} {
  let refusals = 0;
  let overrides = 0;
  let implicitOverrides = 0;
  let quietQuitMoves = 0;
  let desertions = 0;
  let promotions = 0;
  const promotionToRoleCounts: Record<string, number> = {};
  let executedOrders = 0;
  let abilityObservations = 0;
  let vindicatedAbilityObservations = 0;
  let dripEvents = 0;
  let dripGainTotal = 0;
  let regardEvents = 0;
  let regardGainTotal = 0;
  let shameExposures = 0;
  let griefMournings = 0;
  let bitternessFormations = 0;
  let benevLossTarget = 0;
  let benevLossWitness = 0;
  const overrideEvents = events.filter(
    (event): event is Extract<MatchEvent, { t: 'OVERRIDE' }> =>
      event.t === 'OVERRIDE',
  );
  const overrideTargetByPly = new Map<number, PieceId>();
  const overrideLossByPly = new Map<number, number>();
  for (const event of overrideEvents) {
    overrideTargetByPly.set(event.ply, event.pieceId);
    overrideLossByPly.set(event.ply, 0);
  }
  let adjudicationLossTotal = 0;
  const orderTerminatedDesertionPlies = new Set<number>();
  const desertedPieceIds = new Set<PieceId>();
  const fieldedIds = new Set<PieceId>(fieldedPieceIds);
  for (const event of events) {
    const isCommandedPiece =
      'pieceId' in event && fieldedIds.has(event.pieceId);
    switch (event.t) {
      case 'REFUSAL':
        if (isCommandedPiece) refusals += 1;
        break;
      case 'OVERRIDE':
        overrides += 1;
        if (event.implicit === true) implicitOverrides += 1;
        break;
      case 'PSYCH_DELTA':
        if (event.field === 'tauBenev' && event.delta < 0) {
          const targetId = overrideTargetByPly.get(event.ply);
          if (targetId !== undefined) {
            const loss = -event.delta;
            overrideLossByPly.set(
              event.ply,
              (overrideLossByPly.get(event.ply) ?? 0) + loss,
            );
            if (event.pieceId === targetId) benevLossTarget += loss;
            else benevLossWitness += loss;
          }
        }
        break;
      case 'MOVE':
        if (isCommandedPiece) {
          executedOrders += 1;
          if (event.verdict === 'QUIET_QUITTING') quietQuitMoves += 1;
        }
        break;
      case 'DESERTION':
        if (isCommandedPiece) {
          desertions += 1;
          desertedPieceIds.add(event.pieceId);
          orderTerminatedDesertionPlies.add(event.ply);
        }
        break;
      case 'PROMOTION':
        if (isCommandedPiece) {
          promotions += 1;
          promotionToRoleCounts[event.toRole] =
            (promotionToRoleCounts[event.toRole] ?? 0) + 1;
        }
        break;
      case 'ABILITY_OBSERVATION':
        if (isCommandedPiece) {
          abilityObservations += 1;
          if (event.vindicated) vindicatedAbilityObservations += 1;
          if ((event.delta ?? 0) < 0) adjudicationLossTotal -= event.delta ?? 0;
        }
        break;
      case 'ABILITY_DRIP':
        if (isCommandedPiece) {
          dripEvents += 1;
          dripGainTotal += event.gain;
        }
        break;
      case 'REGARD':
        if (isCommandedPiece) {
          regardEvents += 1;
          regardGainTotal += event.gained;
        }
        break;
      case 'SHAME_EXPOSURE':
        if (isCommandedPiece) shameExposures += 1;
        break;
      case 'GRIEF_MOURNING':
        if (isCommandedPiece) griefMournings += 1;
        break;
      case 'BITTERNESS_FORMED':
        if (isCommandedPiece) bitternessFormations += 1;
        break;
      default:
        break;
    }
  }
  const freeOverrideCount = overrideEvents.filter(
    (event) => (overrideLossByPly.get(event.ply) ?? 0) === 0,
  ).length;
  const firstFreeOverridePly = overrideEvents
    .filter((event) => (overrideLossByPly.get(event.ply) ?? 0) === 0)
    .map((event) => event.ply)
    .sort((left, right) => left - right)[0];
  return {
    refusals,
    overrides,
    implicitOverrides,
    quietQuitMoves,
    desertions,
    promotions,
    promotionToRoleCounts,
    executedOrders,
    orderTerminatedDesertionPlies: orderTerminatedDesertionPlies.size,
    abilityObservations,
    vindicatedAbilityObservations,
    dripEvents,
    dripGainTotal,
    regardEvents,
    regardGainTotal,
    shameExposures,
    griefMournings,
    bitternessFormations,
    freeOverrideCount,
    benevLossTarget,
    benevLossWitness,
    freeInsistencePlyFraction:
      firstFreeOverridePly === undefined
        ? 0
        : Math.max(0, plies - firstFreeOverridePly) / Math.max(1, plies),
    adjudicationLossTotal,
    desertedPieceIds,
  };
}

function countSideEvents(
  events: readonly MatchEvent[],
  fieldedPieceIds: readonly PieceId[],
): {
  refusals: number;
  executedOrders: number;
  desertions: number;
  desertedPieceIds: ReadonlySet<PieceId>;
} {
  const fieldedIds = new Set(fieldedPieceIds);
  const desertedPieceIds = new Set<PieceId>();
  let refusals = 0;
  let executedOrders = 0;
  let desertions = 0;
  for (const event of events) {
    const isFieldedPiece = 'pieceId' in event && fieldedIds.has(event.pieceId);
    if (!isFieldedPiece) continue;
    if (event.t === 'REFUSAL') refusals += 1;
    if (event.t === 'MOVE') executedOrders += 1;
    if (event.t === 'DESERTION') {
      desertions += 1;
      desertedPieceIds.add(event.pieceId);
    }
  }
  return { refusals, executedOrders, desertions, desertedPieceIds };
}

function attritionForMetrics(metrics: readonly MatchMetrics[]): number {
  const fieldedPieceIds = new Set<PieceId>();
  const desertedPieceIds = new Set<PieceId>();
  for (const metric of metrics) {
    metric.fieldedPieceIds.forEach((pieceId) => fieldedPieceIds.add(pieceId));
    metric.desertedPieceIds.forEach((pieceId) => desertedPieceIds.add(pieceId));
  }
  if (fieldedPieceIds.size === 0) return 0;
  let desertedFieldedPieces = 0;
  for (const pieceId of desertedPieceIds) {
    if (fieldedPieceIds.has(pieceId)) desertedFieldedPieces += 1;
  }
  return desertedFieldedPieces / fieldedPieceIds.size;
}

function enemyAttritionForMetrics(metrics: readonly MatchMetrics[]): number {
  const fieldedPieceIds = new Set<PieceId>();
  const desertedPieceIds = new Set<PieceId>();
  for (const metric of metrics) {
    metric.enemyFieldedPieceIds.forEach((pieceId) =>
      fieldedPieceIds.add(pieceId),
    );
    metric.enemyDesertedPieceIds.forEach((pieceId) =>
      desertedPieceIds.add(pieceId),
    );
  }
  return fieldedPieceIds.size === 0
    ? 0
    : desertedPieceIds.size / fieldedPieceIds.size;
}

function cascadeLength(events: readonly MatchEvent[]): number {
  let current = 0;
  let max = 0;
  for (const event of events) {
    if (event.t === 'DESERTION') {
      current += 1;
      max = Math.max(max, current);
    } else if (event.t === 'MOVE') {
      current = 0;
    }
  }
  return max;
}

function summarizeDesertions(
  events: readonly MatchEvent[],
  departureKind: 'first' | 'cascade',
  roleById: ReadonlyMap<PieceId, string>,
): DesertionSummary {
  const departures = events.filter(
    (event): event is Extract<MatchEvent, { t: 'DESERTION' }> =>
      event.t === 'DESERTION' && event.departureKind === departureKind,
  );
  const attributed = departures.filter((event) => event.terms !== undefined);
  const count = attributed.length;
  const unknownCauseCount = departures.length - count;
  const mean = (
    pick: (event: Extract<MatchEvent, { t: 'DESERTION' }>) => number,
  ): number =>
    attributed.reduce((sum, event) => sum + pick(event), 0) /
    Math.max(1, count);
  const byRole = (
    pick: (event: Extract<MatchEvent, { t: 'DESERTION' }>) => number,
  ): Readonly<Record<string, number>> => {
    const totals = new Map<string, { sum: number; count: number }>();
    for (const event of attributed) {
      const role = roleById.get(event.pieceId) ?? 'unknown';
      const current = totals.get(role) ?? { sum: 0, count: 0 };
      totals.set(role, {
        sum: current.sum + pick(event),
        count: current.count + 1,
      });
    }
    return Object.fromEntries(
      [...totals.entries()].map(([role, value]) => [
        role,
        value.sum / Math.max(1, value.count),
      ]),
    );
  };
  return {
    count,
    unknownCauseCount,
    meanUStay: mean((event) => event.uStay),
    meanUDesert: mean((event) => event.uDesert),
    meanPCaptured: mean((event) => event.terms?.P_captured ?? 0),
    meanPain: mean((event) => event.terms?.pain ?? 0),
    meanPLossIfStay: mean((event) => event.terms?.P_lossIfStay ?? 0),
    meanPLossIfLeave: mean((event) => event.terms?.P_lossIfLeave ?? 0),
    meanLambda: mean((event) => event.terms?.lambda ?? 0),
    meanLambdaTrust: mean((event) => event.terms?.lambdaTrust ?? 0),
    meanLambdaMorale: mean((event) => event.terms?.lambdaMorale ?? 0),
    meanLambdaLoyalty: mean((event) => event.terms?.lambdaLoyalty ?? 0),
    meanLambdaAffinity: mean((event) => event.terms?.lambdaAffinity ?? 0),
    meanStandingCost: mean((event) => event.terms?.standingCost ?? 0),
    meanAttachment: mean((event) => event.terms?.attachment ?? 0),
    meanPivotality: mean((event) => event.terms?.pivotality ?? 0),
    meanPCapturedPain: mean(
      (event) => (event.terms?.P_captured ?? 0) * (event.terms?.pain ?? 0),
    ),
    meanCollectiveTerm: mean(
      (event) =>
        (event.terms?.lambda ?? 0) *
        (event.terms?.P_lossIfStay ?? 0) *
        ENGINE_CONFIG.DESERTION_COLLECTIVE_STAKE,
    ),
    attachmentByRole: byRole((event) => event.terms?.attachment ?? 0),
    pivotalityByRole: byRole((event) => event.terms?.pivotality ?? 0),
    meanGloryWeight: mean((event) => event.terms?.gloryWeight ?? 0),
    meanTauBenev: mean((event) => event.terms?.tauBenev ?? 0),
    meanTauAbil: mean((event) => event.terms?.tauAbil ?? 0),
  };
}

function classifyArchetype(
  leader: Leader,
  refusalRate: number,
  overrideRate: number,
  desertions: number,
): LeadershipArchetype {
  if (leader === 'redeemer') return 'redeemer_arc';
  if (leader === 'pure_tactician') return 'tactician';
  if (overrideRate > 0.15 || desertions >= 2) return 'tyrant';
  if (refusalRate < 0.02 && overrideRate < 0.01) return 'caretaker';
  if (leader === 'volatile') return 'chaotic';
  return 'mixed';
}

export function metricsFromMatch(
  match: number,
  seed: number,
  leader: Leader,
  rosterStart: readonly import('../src/psychology').PieceState[],
  result: HeadlessMatchResult,
  refusedGoodMoves: number,
): MatchMetrics {
  const fieldedPieceIds = rosterStart.map((piece) => piece.id);
  const fieldedIds = new Set(fieldedPieceIds);
  const abilityRoster = result.roster.filter((piece) =>
    fieldedIds.has(piece.id),
  );
  const abilitySnapshot =
    abilityRoster.length > 0
      ? abilityRoster
      : rosterStart.filter((piece) => fieldedIds.has(piece.id));
  const abilityValues = abilitySnapshot.map((piece) => piece.E_i);
  const abilityMin = Math.min(...abilityValues);
  const abilityMax = Math.max(...abilityValues);
  const meanAbility =
    abilityValues.reduce((sum, value) => sum + value, 0) /
    Math.max(1, abilityValues.length);
  const abilityMovedPieceIds = new Set(
    result.events
      .filter(
        (event): event is Extract<MatchEvent, { t: 'ABILITY_GRADE' }> =>
          event.t === 'ABILITY_GRADE' && event.delta !== 0,
      )
      .map((event) => event.pieceId),
  );
  const abilityMovedCount = fieldedPieceIds.filter((pieceId) =>
    abilityMovedPieceIds.has(pieceId),
  ).length;
  const counts = countEvents(result.events, fieldedPieceIds, result.plies);
  const enemyFieldedPieceIds = result.enemyFieldedPieceIds;
  const enemyCounts = countSideEvents(result.events, enemyFieldedPieceIds);
  const plies = Math.max(1, result.plies);
  const ordersIssued =
    counts.executedOrders +
    counts.refusals +
    counts.orderTerminatedDesertionPlies;
  const refusalRate = counts.refusals / Math.max(1, ordersIssued);
  const refusalsPerPly = counts.refusals / plies;
  const quietQuitRate = counts.quietQuitMoves / plies;
  const refusedGoodMoveRate =
    counts.refusals === 0 ? 0 : refusedGoodMoves / counts.refusals;
  const overrideRate = counts.overrides / plies;
  const enemyRefusalRate =
    enemyCounts.refusals /
    Math.max(
      1,
      enemyCounts.executedOrders +
        enemyCounts.refusals +
        enemyCounts.desertions,
    );
  const enemyAttrition =
    enemyCounts.desertedPieceIds.size /
    Math.max(1, enemyFieldedPieceIds.length);
  const vindicationRate =
    counts.vindicatedAbilityObservations /
    Math.max(1, counts.abilityObservations);
  const adjudicationVindicationRate = vindicationRate;
  const meanTrustStart = meanTrust(rosterStart);
  const meanTrustEnd = meanTrust(result.roster);
  const rosterById = new Map(result.roster.map((piece) => [piece.id, piece]));
  const departedById = new Map(
    result.departedRoster.map((piece) => [piece.id, piece]),
  );
  const startById = new Map(rosterStart.map((piece) => [piece.id, piece]));
  const finalFieldedRoster = fieldedPieceIds.flatMap((pieceId) => {
    const piece =
      rosterById.get(pieceId) ??
      departedById.get(pieceId) ??
      startById.get(pieceId);
    return piece === undefined ? [] : [piece];
  });
  const meanTrustFinal = meanTrust(finalFieldedRoster);
  const meanTauAbilStart = meanTauAbil(rosterStart);
  const meanTauAbilEnd = meanTauAbil(result.roster);
  const meanTauBenevStart = meanTauBenev(rosterStart);
  const meanTauBenevEnd = meanTauBenev(result.roster);
  const meanGriefLoadEnd =
    result.roster.reduce((sum, piece) => sum + (piece.griefLoad ?? 0), 0) /
    Math.max(1, result.roster.length);
  const meanBitternessEnd =
    result.roster.reduce(
      (sum, piece) => sum + (piece.bitternessPermille ?? 0),
      0,
    ) / Math.max(1, result.roster.length);
  const classContemptStart = meanClassContempt(rosterStart);
  const classContemptEnd = meanClassContempt(result.roster);
  const unjustifiedTrauma = foldUnjustifiedTrauma(
    result.events,
    fieldedPieceIds,
    fieldedPieceIds.length,
  );
  const emptiedChairs = counts.desertions;
  const emptiedChairsScore = calculateEmptiedChairsScore(
    emptiedChairs,
    fieldedPieceIds.length,
  );
  const leadershipIndex = calculateSingleMatchLeadershipIndex(
    meanTrustFinal,
    result.winScore,
    unjustifiedTrauma,
    counts.quietQuitMoves,
    emptiedChairsScore,
  );
  return {
    match,
    seed,
    leader,
    plies: result.plies,
    refusals: counts.refusals,
    overrides: counts.overrides,
    freeOverrideCount: counts.freeOverrideCount,
    benevLossTarget: counts.benevLossTarget,
    benevLossWitness: counts.benevLossWitness,
    freeInsistencePlyFraction: counts.freeInsistencePlyFraction,
    implicitOverrides: counts.implicitOverrides,
    quietQuitMoves: counts.quietQuitMoves,
    desertions: counts.desertions,
    promotions: counts.promotions,
    promotionToRoleCounts: counts.promotionToRoleCounts,
    winningPositionDesertions: result.winningPositionDesertions,
    cascadeLength: cascadeLength(result.events),
    firstDeparture: summarizeDesertions(
      result.events,
      'first',
      new Map(rosterStart.map((piece) => [piece.id, piece.role])),
    ),
    cascadeDeparture: summarizeDesertions(
      result.events,
      'cascade',
      new Map(rosterStart.map((piece) => [piece.id, piece.role])),
    ),
    refusedGoodMoves,
    abilityObservations: counts.abilityObservations,
    vindicatedAbilityObservations: counts.vindicatedAbilityObservations,
    vindicationRate,
    dripEvents: counts.dripEvents,
    dripGainTotal: counts.dripGainTotal,
    regardEvents: counts.regardEvents,
    regardGainTotal: counts.regardGainTotal,
    shameExposures: counts.shameExposures,
    griefMournings: counts.griefMournings,
    bitternessFormations: counts.bitternessFormations,
    meanGriefLoadEnd,
    meanBitternessEnd,
    adjudicationObservations: counts.abilityObservations,
    adjudicationVindicationRate,
    adjudicationLossTotal: counts.adjudicationLossTotal,
    meanAdjudicationLoss:
      counts.abilityObservations === 0
        ? 0
        : counts.adjudicationLossTotal / counts.abilityObservations,
    finalTauAbilByRole: Object.fromEntries(
      [...new Set(result.roster.map((piece) => piece.role))].map((role) => {
        const pieces = result.roster.filter((piece) => piece.role === role);
        return [
          role,
          pieces.reduce((total, piece) => total + piece.credence.tauAbil, 0) /
            Math.max(1, pieces.length),
        ];
      }),
    ),
    abilityMin: abilityValues.length > 0 ? abilityMin : 0,
    abilityMax: abilityValues.length > 0 ? abilityMax : 0,
    meanAbility,
    abilityMovedCount,
    fieldedPieceIds,
    desertedPieceIds: [...counts.desertedPieceIds],
    refusalRate,
    refusalsPerPly,
    quietQuitRate,
    refusedGoodMoveRate,
    overrideRate,
    meanTrustStart,
    meanTrustEnd,
    meanTrustFinal,
    meanTauAbilStart,
    meanTauAbilEnd,
    meanTauBenevStart,
    meanTauBenevEnd,
    classContemptStart,
    classContemptEnd,
    survivingRosterSize: result.roster.length,
    enemyAttrition,
    enemyFieldedPieceIds,
    enemySurvivingRosterSize: result.enemyRoster.length,
    enemyDesertions: enemyCounts.desertions,
    enemyDesertedPieceIds: [...enemyCounts.desertedPieceIds],
    retirements: 0,
    graceEvents: 0,
    enemyRetirements: 0,
    enemyGraceEvents: 0,
    enemyRefusalRate,
    winScore: result.winScore,
    unjustifiedTrauma,
    emptiedChairs,
    emptiedChairsScore,
    leadershipIndex,
    rout: result.rout,
    dismissed: result.dismissed,
    dismissalCause: result.dismissalCause,
    dismissalPly: result.dismissalPly,
    archetype: classifyArchetype(
      leader,
      refusalRate,
      overrideRate,
      counts.desertions,
    ),
  };
}

function quartileForMatch(match: number, matches: number): Quartile {
  return Math.min(4, Math.floor(((match - 1) * 4) / matches) + 1) as Quartile;
}

export function buildTrajectoryBands(
  matchMetrics: readonly MatchMetrics[],
): readonly CampaignTrajectoryBand[] {
  const matches = matchMetrics.length;
  return ([1, 2, 3, 4] as const).map((quartile) => {
    const metrics = matchMetrics.filter(
      (metric) => quartileForMatch(metric.match, matches) === quartile,
    );
    const first = metrics[0];
    const last = metrics.at(-1);
    const mean = (pick: (metric: MatchMetrics) => number): number =>
      metrics.reduce((sum, metric) => sum + pick(metric), 0) /
      Math.max(1, metrics.length);
    return {
      quartile,
      startMatch: first?.match ?? 0,
      endMatch: last?.match ?? 0,
      matches: metrics.length,
      meanTauAbil: mean((metric) => metric.meanTauAbilEnd),
      meanTauBenev: mean((metric) => metric.meanTauBenevEnd),
      meanRefusalRate: mean((metric) => metric.refusalRate),
      meanRefusalsPerPly: mean((metric) => metric.refusalsPerPly),
      meanVindicationRate: mean((metric) => metric.vindicationRate ?? 0),
      meanDripEvents: mean((metric) => metric.dripEvents ?? 0),
      meanAdjudicationVindicationRate: mean(
        (metric) => metric.adjudicationVindicationRate ?? 0,
      ),
      meanFinalTauAbilByRole: Object.fromEntries(
        [
          ...new Set(
            metrics.flatMap((metric) =>
              Object.keys(metric.finalTauAbilByRole ?? {}),
            ),
          ),
        ].map((role) => [
          role,
          mean((metric) => metric.finalTauAbilByRole?.[role] ?? 0),
        ]),
      ),
      desertionMatchRate:
        metrics.filter((metric) => metric.desertions > 0).length /
        Math.max(1, metrics.length),
      desertionAttrition: attritionForMetrics(metrics),
      routRate:
        metrics.filter((metric) => metric.rout).length /
        Math.max(1, metrics.length),
      meanSurvivingRosterSize: mean((metric) => metric.survivingRosterSize),
      enemyDesertionAttrition: enemyAttritionForMetrics(metrics),
      meanEnemySurvivingRosterSize: mean(
        (metric) => metric.enemySurvivingRosterSize,
      ),
      meanEnemyDesertions: mean((metric) => metric.enemyDesertions),
      meanEnemyRefusalRate: mean((metric) => metric.enemyRefusalRate),
      meanAttritionDifferential:
        mean((metric) => attritionForMetrics([metric])) -
        mean((metric) => metric.enemyAttrition),
      meanSurvivingRosterDifferential: mean(
        (metric) =>
          metric.survivingRosterSize - metric.enemySurvivingRosterSize,
      ),
      meanDesertionDifferential: mean(
        (metric) => metric.desertions - metric.enemyDesertions,
      ),
      meanRefusalRateDifferential: mean(
        (metric) => metric.refusalRate - metric.enemyRefusalRate,
      ),
      meanWinScore: mean((metric) => metric.winScore),
    };
  });
}

export interface CampaignMatchTrajectoryPoint {
  readonly match: number;
  readonly meanTauAbil: number;
  readonly meanTauBenev: number;
  readonly meanSurvivingRosterSize: number;
}

export function buildMatchTrajectory(
  matchMetrics: readonly MatchMetrics[],
): readonly CampaignMatchTrajectoryPoint[] {
  return matchMetrics.map((metric) => ({
    match: metric.match,
    meanTauAbil: metric.meanTauAbilEnd,
    meanTauBenev: metric.meanTauBenevEnd,
    meanSurvivingRosterSize: metric.survivingRosterSize,
  }));
}

function aggregateCampaignCore(
  leader: Leader,
  seed: number,
  matchMetrics: readonly MatchMetrics[],
): Omit<CampaignMetrics, 'horizon'> {
  const matches = matchMetrics.length;
  const desertionMatchRate =
    matchMetrics.filter((metric) => metric.desertions > 0).length /
    Math.max(1, matches);
  const desertionAttrition = attritionForMetrics(matchMetrics);
  const totalDesertions = matchMetrics.reduce(
    (sum, metric) => sum + metric.desertions,
    0,
  );
  const winningPositionDesertionRate =
    matchMetrics.reduce(
      (sum, metric) => sum + metric.winningPositionDesertions,
      0,
    ) / Math.max(1, totalDesertions);
  const routCampaignRate =
    matchMetrics.filter((metric) => metric.rout).length / Math.max(1, matches);
  const mean = (pick: (metric: MatchMetrics) => number): number =>
    matchMetrics.reduce((sum, metric) => sum + pick(metric), 0) /
    Math.max(1, matches);
  const trustTrajectory = matchMetrics.map((metric) => ({
    match: metric.match,
    meanTrustEnd: metric.meanTrustEnd,
  }));
  const last = matchMetrics.at(-1);
  const perRoleCulture: PerRoleCultureMetric[] =
    last === undefined
      ? []
      : [
          {
            role: 'aggregate',
            meanContemptEnd: last.classContemptEnd,
          },
        ];
  return {
    leader,
    seed,
    matches,
    matchMetrics,
    desertionMatchRate,
    desertionAttrition,
    winningPositionDesertionRate,
    routCampaignRate,
    meanRefusalRate: mean((metric) => metric.refusalRate),
    meanRefusalsPerPly: mean((metric) => metric.refusalsPerPly),
    meanQuietQuitRate: mean((metric) => metric.quietQuitRate),
    meanRefusedGoodMoveRate: mean((metric) => metric.refusedGoodMoveRate),
    meanOverrideRate: mean((metric) => metric.overrideRate),
    meanOverrideCount: mean((metric) => metric.overrides),
    meanFreeOverrideCount: mean((metric) => metric.freeOverrideCount ?? 0),
    meanBenevLossTarget: mean((metric) => metric.benevLossTarget ?? 0),
    meanBenevLossWitness: mean((metric) => metric.benevLossWitness ?? 0),
    meanFreeInsistencePlyFraction: mean(
      (metric) => metric.freeInsistencePlyFraction ?? 0,
    ),
    meanPlies: mean((metric) => metric.plies),
    winCount: matchMetrics.filter((metric) => metric.winScore === 100).length,
    drawCount: matchMetrics.filter((metric) => metric.winScore === 50).length,
    lossCount: matchMetrics.filter((metric) => metric.winScore === 0).length,
    meanPromotionsPerMatch: mean((metric) => metric.promotions),
    promotionMatchRate:
      matchMetrics.filter((metric) => metric.promotions > 0).length /
      Math.max(1, matches),
    promotionToRoleCounts: Object.fromEntries(
      [
        ...new Set(
          matchMetrics.flatMap((metric) =>
            Object.keys(metric.promotionToRoleCounts),
          ),
        ),
      ].map((role) => [
        role,
        matchMetrics.reduce(
          (total, metric) => total + (metric.promotionToRoleCounts[role] ?? 0),
          0,
        ),
      ]),
    ),
    meanWinScore: mean((metric) => metric.winScore),
    meanUnjustifiedTrauma: mean((metric) => metric.unjustifiedTrauma),
    meanEmptiedChairs: mean((metric) => metric.emptiedChairs),
    meanEmptiedChairsScore: mean((metric) => metric.emptiedChairsScore),
    meanLeadershipIndex: mean((metric) => metric.leadershipIndex),
    meanTrustFinal: mean((metric) => metric.meanTrustFinal),
    meanDesertions: mean((metric) => metric.desertions),
    meanRetirements: mean((metric) => metric.retirements ?? 0),
    meanGraceEvents: mean((metric) => metric.graceEvents ?? 0),
    meanSurvivingRosterSize: mean((metric) => metric.survivingRosterSize),
    enemyDesertionAttrition: enemyAttritionForMetrics(matchMetrics),
    meanEnemySurvivingRosterSize: mean(
      (metric) => metric.enemySurvivingRosterSize,
    ),
    meanEnemyDesertions: mean((metric) => metric.enemyDesertions),
    meanEnemyRetirements: mean((metric) => metric.enemyRetirements ?? 0),
    meanEnemyGraceEvents: mean((metric) => metric.enemyGraceEvents ?? 0),
    meanEnemyRefusalRate: mean((metric) => metric.enemyRefusalRate),
    meanAttritionDifferential: mean(
      (metric) => attritionForMetrics([metric]) - metric.enemyAttrition,
    ),
    meanSurvivingRosterDifferential: mean(
      (metric) => metric.survivingRosterSize - metric.enemySurvivingRosterSize,
    ),
    meanDesertionDifferential: mean(
      (metric) => metric.desertions - metric.enemyDesertions,
    ),
    meanRefusalRateDifferential: mean(
      (metric) => metric.refusalRate - metric.enemyRefusalRate,
    ),
    meanTauAbil: mean((metric) => metric.meanTauAbilEnd),
    meanDripGainTotal: mean((metric) => metric.dripGainTotal ?? 0),
    meanRegardEvents: mean((metric) => metric.regardEvents ?? 0),
    meanRegardGainTotal: mean((metric) => metric.regardGainTotal ?? 0),
    meanShameExposures: mean((metric) => metric.shameExposures ?? 0),
    meanGriefMournings: mean((metric) => metric.griefMournings ?? 0),
    meanBitternessFormations: mean(
      (metric) => metric.bitternessFormations ?? 0,
    ),
    meanGriefLoadEnd: mean((metric) => metric.meanGriefLoadEnd ?? 0),
    meanBitternessEnd: mean((metric) => metric.meanBitternessEnd ?? 0),
    meanAdjudicationLoss: mean((metric) => metric.meanAdjudicationLoss ?? 0),
    meanTauBenev: mean((metric) => metric.meanTauBenevEnd),
    abilityMin: mean((metric) => metric.abilityMin ?? 0),
    abilityMax: mean((metric) => metric.abilityMax ?? 0),
    meanAbility: mean((metric) => metric.meanAbility ?? 0),
    abilityMovedCount: mean((metric) => metric.abilityMovedCount ?? 0),
    meanTrustEnd: last?.meanTrustEnd ?? 0,
    meanTrustDelta: mean(
      (metric) => metric.meanTrustEnd - metric.meanTrustStart,
    ),
    classContemptDelta:
      mean((metric) => metric.classContemptEnd) -
      mean((metric) => metric.classContemptStart),
    trustTrajectory,
    perRoleCulture,
    trajectoryBands: buildTrajectoryBands(matchMetrics),
  };
}

function horizonFromSummary(
  horizon: number,
  summary: Omit<CampaignMetrics, 'horizon'>,
): CampaignHorizon {
  const metrics = summary.matchMetrics.slice(0, horizon);
  const winCount = metrics.filter((metric) => metric.winScore === 100).length;
  const drawCount = metrics.filter((metric) => metric.winScore === 50).length;
  const lossCount = metrics.filter((metric) => metric.winScore === 0).length;
  const count = Math.max(1, metrics.length);
  return {
    horizon,
    meanWinScore: summary.meanWinScore,
    winCount,
    drawCount,
    lossCount,
    winRate: winCount / count,
    drawRate: drawCount / count,
    lossRate: lossCount / count,
    routRate: summary.routCampaignRate,
    meanRefusalRate: summary.meanRefusalRate,
    meanRefusalsPerPly: summary.meanRefusalsPerPly,
    desertionMatchRate: summary.desertionMatchRate,
    desertionAttrition: summary.desertionAttrition,
    meanDesertions: summary.meanDesertions,
    meanSurvivingRosterSize: summary.meanSurvivingRosterSize,
    enemyDesertionAttrition: summary.enemyDesertionAttrition,
    meanEnemySurvivingRosterSize: summary.meanEnemySurvivingRosterSize,
    meanEnemyDesertions: summary.meanEnemyDesertions,
    meanEnemyRefusalRate: summary.meanEnemyRefusalRate,
    attritionDifferential:
      summary.desertionAttrition - summary.enemyDesertionAttrition,
    survivingRosterDifferential:
      summary.meanSurvivingRosterSize - summary.meanEnemySurvivingRosterSize,
    desertionDifferential: summary.meanDesertions - summary.meanEnemyDesertions,
    refusalRateDifferential:
      summary.meanRefusalRate - summary.meanEnemyRefusalRate,
    meanTauAbil: summary.meanTauAbil,
    meanTauBenev: summary.meanTauBenev,
    meanTrustEnd: summary.meanTrustEnd,
  };
}

export function buildHorizonSeries(
  matchMetrics: readonly MatchMetrics[],
): readonly CampaignHorizon[] {
  const first = matchMetrics[0];
  if (first === undefined) return [];
  return matchMetrics.map((_, index) =>
    horizonFromSummary(
      index + 1,
      aggregateCampaignCore(
        first.leader,
        first.seed,
        matchMetrics.slice(0, index + 1),
      ),
    ),
  );
}

export function aggregateCampaign(
  leader: Leader,
  seed: number,
  matchMetrics: readonly MatchMetrics[],
): CampaignMetrics {
  const summary = aggregateCampaignCore(leader, seed, matchMetrics);
  return {
    ...summary,
    horizon: buildHorizonSeries(matchMetrics),
  };
}

export function renderCsv(
  metrics: readonly MatchMetrics[],
  trajectoryBands?: readonly CampaignTrajectoryBand[],
  horizon?: readonly CampaignHorizon[],
  controlHorizon?: readonly ControlHorizon[],
): string {
  const rows = metrics.map((metric) =>
    [
      metric.match,
      metric.seed,
      metric.leader,
      metric.plies,
      metric.refusals,
      metric.overrides,
      metric.implicitOverrides,
      metric.quietQuitMoves,
      metric.desertions,
      metric.promotions,
      JSON.stringify(metric.promotionToRoleCounts),
      metric.firstDeparture.count,
      metric.firstDeparture.unknownCauseCount,
      metric.cascadeDeparture.count,
      metric.cascadeDeparture.unknownCauseCount,
      metric.cascadeLength,
      metric.firstDeparture.meanUStay.toFixed(3),
      metric.firstDeparture.meanUDesert.toFixed(3),
      metric.firstDeparture.meanPCaptured.toFixed(4),
      metric.firstDeparture.meanPain.toFixed(3),
      metric.firstDeparture.meanPLossIfStay.toFixed(4),
      metric.firstDeparture.meanPLossIfLeave.toFixed(4),
      metric.firstDeparture.meanLambda.toFixed(4),
      metric.firstDeparture.meanLambdaTrust.toFixed(4),
      metric.firstDeparture.meanLambdaMorale.toFixed(4),
      metric.firstDeparture.meanLambdaLoyalty.toFixed(4),
      metric.firstDeparture.meanLambdaAffinity.toFixed(4),
      metric.firstDeparture.meanStandingCost.toFixed(3),
      metric.firstDeparture.meanGloryWeight.toFixed(4),
      metric.firstDeparture.meanTauBenev.toFixed(3),
      metric.firstDeparture.meanTauAbil.toFixed(3),
      metric.refusedGoodMoves,
      metric.refusalRate.toFixed(4),
      metric.refusalsPerPly.toFixed(4),
      metric.quietQuitRate.toFixed(4),
      metric.refusedGoodMoveRate.toFixed(4),
      metric.overrideRate.toFixed(4),
      metric.meanTrustStart.toFixed(2),
      metric.meanTrustEnd.toFixed(2),
      metric.classContemptStart.toFixed(2),
      metric.classContemptEnd.toFixed(2),
      metric.winScore,
      metric.rout ? 1 : 0,
      metric.archetype,
      metric.meanTauAbilStart.toFixed(2),
      metric.meanTauAbilEnd.toFixed(2),
      metric.meanTauBenevStart.toFixed(2),
      metric.meanTauBenevEnd.toFixed(2),
      metric.survivingRosterSize,
      metric.enemyAttrition.toFixed(4),
      metric.enemySurvivingRosterSize,
      metric.enemyDesertions,
      metric.enemyRefusalRate.toFixed(4),
      metric.retirements ?? 0,
      metric.graceEvents ?? 0,
      metric.enemyRetirements ?? 0,
      metric.enemyGraceEvents ?? 0,
      metric.dripEvents ?? 0,
      (metric.dripGainTotal ?? 0).toFixed(2),
      metric.regardEvents ?? 0,
      (metric.regardGainTotal ?? 0).toFixed(2),
      metric.freeOverrideCount ?? 0,
      (metric.benevLossTarget ?? 0).toFixed(2),
      (metric.benevLossWitness ?? 0).toFixed(2),
      (metric.freeInsistencePlyFraction ?? 0).toFixed(4),
      metric.unjustifiedTrauma.toFixed(2),
      metric.leadershipIndex.toFixed(2),
      metric.meanTrustFinal.toFixed(2),
      metric.emptiedChairs,
      metric.emptiedChairsScore.toFixed(2),
      metric.dismissed ? 1 : 0,
      metric.dismissalCause ?? '',
      metric.dismissalPly ?? '',
      metric.shameExposures ?? 0,
      metric.griefMournings ?? 0,
      metric.bitternessFormations ?? 0,
      (metric.meanGriefLoadEnd ?? 0).toFixed(2),
      (metric.meanBitternessEnd ?? 0).toFixed(2),
    ]
      .map(csvField)
      .join(','),
  );
  const output = [CSV_HEADER, ...rows];
  if (trajectoryBands !== undefined) {
    output.push(
      '',
      'trajectory_quartile,start_match,end_match,matches,mean_tau_abil,mean_tau_benev,mean_refusal_rate,mean_refusals_per_ply,desertion_match_rate,desertion_attrition,rout_rate,mean_surviving_roster_size,enemy_desertion_attrition,mean_enemy_surviving_roster_size,mean_enemy_desertions,mean_enemy_refusal_rate,mean_attrition_differential,mean_surviving_roster_differential,mean_desertion_differential,mean_refusal_rate_differential,mean_win_score',
      ...trajectoryBands.map((band) =>
        [
          band.quartile,
          band.startMatch,
          band.endMatch,
          band.matches,
          band.meanTauAbil.toFixed(2),
          band.meanTauBenev.toFixed(2),
          band.meanRefusalRate.toFixed(4),
          band.meanRefusalsPerPly.toFixed(4),
          band.desertionMatchRate.toFixed(4),
          band.desertionAttrition.toFixed(4),
          band.routRate.toFixed(4),
          band.meanSurvivingRosterSize.toFixed(2),
          band.enemyDesertionAttrition.toFixed(4),
          band.meanEnemySurvivingRosterSize.toFixed(2),
          band.meanEnemyDesertions.toFixed(2),
          band.meanEnemyRefusalRate.toFixed(4),
          band.meanAttritionDifferential.toFixed(4),
          band.meanSurvivingRosterDifferential.toFixed(2),
          band.meanDesertionDifferential.toFixed(2),
          band.meanRefusalRateDifferential.toFixed(4),
          band.meanWinScore.toFixed(2),
        ]
          .map(csvField)
          .join(','),
      ),
    );
  }
  output.push(
    '',
    'trajectory_match,mean_tau_abil_end,mean_tau_benev_end,mean_surviving_roster_size',
    ...buildMatchTrajectory(metrics).map((point) =>
      [
        point.match,
        point.meanTauAbil.toFixed(2),
        point.meanTauBenev.toFixed(2),
        point.meanSurvivingRosterSize,
      ]
        .map(csvField)
        .join(','),
    ),
  );
  if (horizon !== undefined) {
    output.push(
      '',
      'horizon,mean_win_score,win_count,draw_count,loss_count,win_rate,draw_rate,loss_rate,rout_rate,mean_refusal_rate,mean_refusals_per_ply,desertion_match_rate,desertion_attrition,mean_desertions,mean_surviving_roster_size,enemy_desertion_attrition,mean_enemy_surviving_roster_size,mean_enemy_desertions,mean_enemy_refusal_rate,attrition_differential,surviving_roster_differential,desertion_differential,refusal_rate_differential,mean_tau_abil,mean_tau_benev,mean_trust_end',
      ...horizon.map((point) =>
        [
          point.horizon,
          point.meanWinScore.toFixed(2),
          point.winCount,
          point.drawCount,
          point.lossCount,
          point.winRate.toFixed(4),
          point.drawRate.toFixed(4),
          point.lossRate.toFixed(4),
          point.routRate.toFixed(4),
          point.meanRefusalRate.toFixed(4),
          point.meanRefusalsPerPly.toFixed(4),
          point.desertionMatchRate.toFixed(4),
          point.desertionAttrition.toFixed(4),
          point.meanDesertions.toFixed(2),
          point.meanSurvivingRosterSize.toFixed(2),
          point.enemyDesertionAttrition.toFixed(4),
          point.meanEnemySurvivingRosterSize.toFixed(2),
          point.meanEnemyDesertions.toFixed(2),
          point.meanEnemyRefusalRate.toFixed(4),
          point.attritionDifferential.toFixed(4),
          point.survivingRosterDifferential.toFixed(2),
          point.desertionDifferential.toFixed(2),
          point.refusalRateDifferential.toFixed(4),
          point.meanTauAbil.toFixed(2),
          point.meanTauBenev.toFixed(2),
          point.meanTrustEnd.toFixed(2),
        ]
          .map(csvField)
          .join(','),
      ),
    );
  }
  if (controlHorizon !== undefined) {
    output.push(
      '',
      'matched_skill_horizon,mean_win_score,win_rate,draw_rate,loss_rate',
      ...controlHorizon.map((point) =>
        [
          point.horizon,
          point.meanWinScore.toFixed(2),
          point.winRate.toFixed(4),
          point.drawRate.toFixed(4),
          point.lossRate.toFixed(4),
        ]
          .map(csvField)
          .join(','),
      ),
    );
  }
  return `${output.join('\n')}\n`;
}
