import { campaignDebrief, matchAudit } from './audit';
import { composePieceLine, pickVariant } from './compose';
import treeJson from './data/dialogue-tree.json';
import { loadDialogueTree } from './tree';
import type { DialogueTree } from './tree';
import type {
  AuditProse,
  CampaignTelemetry,
  DebriefProse,
  MatchIntroContext,
  MatchTelemetry,
  NarrationProvider,
  PieceLineContext,
} from './types';

/**
 * `AuthoredProvider` — the only shipped `NarrationProvider` (ADR 0004). It reads
 * the committed, reviewed dialogue tree and composes lines synchronously and
 * deterministically. There is no model call, no network, and no key.
 */

/** The committed tree, structurally validated at module load. */
export const DEFAULT_TREE: DialogueTree = loadDialogueTree(treeJson);

function composeIntro(tree: DialogueTree, context: MatchIntroContext): string {
  const banks = tree.personas[context.persona];
  const line = pickVariant(
    banks.intro[context.mandate],
    context.seed,
    `intro.${context.mandate}`,
    'intro',
    Math.max(0, context.act - 1),
  );
  const actNote =
    context.act <= 1
      ? 'This is your first command.'
      : `This is command number ${context.act}.`;
  return line.length > 0 ? `${actNote} ${line}` : actNote;
}

/**
 * Build an authored provider over a dialogue tree (the committed tree by
 * default). Injecting a tree is for tests and, later, content packs (D53).
 */
export function createAuthoredProvider(
  tree: DialogueTree = DEFAULT_TREE,
): NarrationProvider {
  return {
    pieceLine(context: PieceLineContext): string {
      return composePieceLine(tree, context);
    },
    narratorIntro(context: MatchIntroContext): string {
      return composeIntro(tree, context);
    },
    matchAudit(telemetry: MatchTelemetry): AuditProse {
      return matchAudit(tree, telemetry);
    },
    campaignDebrief(telemetry: CampaignTelemetry): DebriefProse {
      return campaignDebrief(tree, telemetry);
    },
  };
}
