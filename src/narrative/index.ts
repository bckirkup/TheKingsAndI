export { createAuthoredProvider, DEFAULT_TREE } from './authoredProvider';
export { campaignDebrief, matchAudit } from './audit';
export { composePieceLine, pickVariant } from './compose';
export { affinityBand, credenceBand, NARRATION_CONFIG } from './config';
export type { NarrationConfig } from './config';
export { validateCoverage } from './coverage';
export type { CoverageReport } from './coverage';
export { sanitizeName } from './sanitize';
export {
  CREDENCE_BANDS,
  NEGATIVE_GRIEVANCES,
  NEGATIVE_VERDICTS,
  PERSONAS,
  POSITIVE_VERDICTS,
  reachableSituations,
  situationKey,
} from './situations';
export type { ReachableSituation, SituationKey } from './situations';
export { loadDialogueTree } from './tree';
export type { DialogueTree, PersonaBanks } from './tree';
export type {
  AffinityBand,
  AuditProse,
  CampaignMatchProjection,
  CampaignTelemetry,
  CredenceBand,
  CredenceBands,
  DebriefProse,
  DepartureProjection,
  GrievanceKind,
  MatchIntroContext,
  MatchOutcome,
  MatchTelemetry,
  NarrationProvider,
  PersonaId,
  PieceLineContext,
  PieceRef,
  RoleLabel,
  Verdict,
} from './types';
