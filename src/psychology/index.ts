export { ENGINE_CONFIG } from './config';
export type { EngineConfig } from './config';
export { attentionWeight, applyRumorDiffusion, diffuseRumor } from './belief';
export {
  clampAffinity,
  clampCredence,
  clampInt,
  clampMorale,
  clampPermille,
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
  calculateFaithGap,
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
  calculateBenchingTrustPenalties,
  calculateSingleMatchLeadershipIndex,
  compileCampaignCultureDrift,
} from './events';
export { applyOverride } from './override';
export {
  applyCaptureInjury,
  applySustainedDread,
  type DreadExposure,
} from './trauma';
export {
  defaultCredence,
  defaultRumor,
  normalizePieceState,
  removePieceFromRoster,
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
