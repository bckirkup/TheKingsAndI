export {
  CREDENCE_BAND_CONFIG,
  credenceBand,
  lineFor,
  sanitizePieceLabel,
  situationFor,
  situationKeyFor,
  type CredenceReading,
  type DesertionGrievance,
  type DialogueCue,
  type NarrationRequest,
  type SituationKey,
} from './authoredProvider';
export {
  allSituationKeys,
  DIALOGUE_LINES,
  totalDialogueLineCount,
} from './dialogueTree';
export {
  MINIMUM_VARIANTS_PER_SITUATION,
  longestConsecutiveRepeat,
  reachableSituationKeys,
  validateNarrationCoverage,
  type CoverageReport,
} from './coverage';
export {
  BANNED_DISPOSITION_PHRASES,
  scanTraitLeakage,
  type TraitLeakageFinding,
} from './traitLeakage';
export {
  NOUN_MAP,
  noticeFor,
  renderNotice,
  type FixedNotice,
  type NoticeId,
} from './notices';
export {
  AUDIT_PROSE_CONFIG,
  campaignDebriefProse,
  matchAuditProse,
  narratorIntro,
  narratorIntroVariants,
  type AuditProse,
  type AuditProseConfig,
  type CampaignMatchProse,
  type CampaignProseInput,
  type DebriefProse,
  type IntroProseInput,
  type MatchProseInput,
  type NarratedOutcome,
} from './audit';
