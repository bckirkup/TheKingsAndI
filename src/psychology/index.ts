export { ENGINE_CONFIG } from './config';
export type { EngineConfig } from './config';
export { attentionWeight, applyRumorDiffusion, diffuseRumor } from './belief';
export { counselForCandidate, counselOpinionValue } from './counsel';
export type {
  CounselCandidate,
  CounselOpinion,
  CounselReason,
  CounselVolunteering,
  PieceCounsel,
} from './counsel';
export {
  clampAffinity,
  clampCredence,
  clampInt,
  clampMorale,
  clampPermille,
  clampRuptureDebt,
  clampTrauma,
  clampTrust,
} from './clamp';
export {
  applyAuthorityLoss,
  applyAuthorityGain,
  applyAbilityDrip,
  applyAbilityObservation,
  applyBetrayalSignal,
  applyHeardSignal,
  applyNeglectSignal,
  applyRegardSignal,
  applyRepairSignal,
  isRegardEligible,
  calculateFaithGap,
  effectiveAbilityCredence,
  calculatePerceivedValue,
  justifiedRefusalObviousness,
  justifiedRefusalAuthorityLoss,
  isExpendableRefusal,
} from './credence';
export { calculateEngineSearchDepth } from './depth';
export {
  applyDesertionWithCascade,
  buildDesertionContexts,
  desertionContextFor,
} from './cascade';
export type { CascadeResult, DesertionDeparture } from './cascade';
export {
  calculateLambda,
  calculateLambdaComponents,
  calculatePain,
  calculatePivotalityPermille,
  calculateShadowFactor,
  calculateUDesert,
  calculateAttachment,
  calculateAttachmentPermille,
  calculateStayAttachmentWeightPermille,
  calculateUStay,
  isKingExempt,
  raiseLossEstimatesAfterDesertion,
  shouldDesert,
} from './desertion';
export type { LambdaComponents } from './desertion';
export {
  appendEvent,
  applyWitnessedSacrificeEvent,
  applyPosthumousClassCreditEvent,
  calculateBenchingTrustPenalties,
  calculateSingleMatchLeadershipIndex,
  compileCampaignCultureDrift,
  courageForMove,
  foldCourage,
  foldHope,
  foldUnjustifiedTrauma,
  trackPromotionHope,
} from './events';
export type { PromotionHopeState } from './events';
export { applyOverride } from './override';
export { witnessAttachmentPermille } from './standing';
export {
  applyCaptureInjury,
  applyGrace,
  applySustainedDread,
  type DreadExposure,
} from './trauma';
export { applyMorningLift } from './morningLift';
export {
  defaultCredence,
  defaultRumor,
  applyEarnedAbilityObservation,
  normalizePieceState,
  removePieceFromRoster,
  startingAbilityForRole,
  updatePieceInRoster,
} from './reducers';
export { replayDigest, replayMatch } from './replay';
export type {
  CampaignCultureDriftVector,
  CandidateMoveEvaluation,
  ClassPrestigeMatrix,
  CostlySignalKind,
  DesertionDecisionTerms,
  CredenceState,
  DesertionContext,
  MatchEvent,
  MoveDecisionOutcome,
  MoveResponseVerdict,
  PieceRole,
  PieceState,
  PieceTraits,
  PsychField,
  ReplayManifest,
  ReplayPly,
  ReplayResult,
  RumorState,
  SacrificeAttribution,
} from './types';
export {
  applyCostlySignal,
  applyMatchOutcomeTrust,
  costlySignalCredit,
} from './trust';
export { applyCohortHistory } from './cohortHistory';
export {
  calculateInterPieceProtection,
  calculateMoveUtility,
  calculateRefusalThreshold,
} from './utility';
export {
  evaluateDesertionCascade,
  evaluateMoveResponse,
  applyFatalisticComplianceCosts,
  isFatalisticCompliance,
} from './verdict';
export {
  appraiseDesertionWitness,
  isWitnessedSacrifice,
  sharedBondScalar,
} from './witness';
