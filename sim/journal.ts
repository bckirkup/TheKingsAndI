import { digest } from '../src/core/digest';
import { compareCodeUnits } from '../src/core/canonicalJson';
import {
  extractMoveFeatures,
  type LivingBoard,
  type MoveIntent,
  type Side,
} from '../src/chess';
import {
  projectMoveObservation,
  projectOverrideObservation,
  type HeadlessLeaderPort,
  type Observation,
} from '../src/orchestration';
import type { HeadlessMoveChoice } from '../src/orchestration/headlessMatch';

export type DecisionKind = 'move' | 'override';

export interface Option {
  readonly kind: 'move' | 'override' | 'stand' | 'disengage';
  readonly san?: string;
}

export interface AgentIdentity {
  readonly id: string;
  readonly promptVersion: string;
  readonly optionSetVersion: string;
}

export interface JournalEntry {
  readonly decisionIndex: number;
  readonly at: {
    readonly match: number;
    readonly ply?: number;
    readonly kind: DecisionKind;
    readonly side: Side;
  };
  readonly observation: Observation;
  readonly observationDigest: string;
  readonly options: readonly Option[];
  readonly chosen: number;
  readonly rationale?: string;
  readonly agent: AgentIdentity;
  readonly resolvedBy?: 'agent' | 'fallback';
  readonly fallbackPolicy?: 'inner';
}

export interface JournalAgentRequest {
  readonly observation: Observation;
  readonly observationDigest: string;
  readonly options: readonly Option[];
  readonly agent: AgentIdentity;
  readonly scriptedChoice?: number;
  readonly decisionIndex?: number;
}

export interface JournalAgent {
  readonly identity: AgentIdentity;
  readonly scripted?: boolean;
  decide(request: JournalAgentRequest): number | undefined;
}

export interface JournalOptions {
  readonly agent: JournalAgent;
  readonly match: number;
  readonly entries: JournalEntry[];
  readonly rationale?: string;
}

const DISENGAGE: Option = { kind: 'disengage' };

function optionsForMove(board: LivingBoard, side: Side): Option[] {
  return [
    ...board
      .legalMoves()
      .filter((intent) => board.pieceAt(intent.from)?.side === side)
      .map((intent) => {
        const features = extractMoveFeatures(board, intent);
        return { kind: 'move' as const, san: features.san };
      })
      .sort((left, right) => compareCodeUnits(left.san ?? '', right.san ?? '')),
    DISENGAGE,
  ];
}

function selectedIndex(
  options: readonly Option[],
  choice: HeadlessMoveChoice | undefined,
): number | undefined {
  if (choice === undefined) return undefined;
  return options.findIndex(
    (option) => option.kind === 'move' && option.san === choice.san,
  );
}

export function scriptedAgent(): JournalAgent {
  return {
    scripted: true,
    identity: {
      id: 'scripted',
      promptVersion: 'none',
      optionSetVersion: 'v1',
    },
    decide(request) {
      return request.scriptedChoice;
    },
  };
}

function choiceForSan(
  board: LivingBoard,
  side: Side,
  san: string,
): HeadlessMoveChoice | undefined {
  const intent = board
    .legalMoves()
    .find(
      (candidate: MoveIntent) =>
        board.pieceAt(candidate.from)?.side === side &&
        extractMoveFeatures(board, candidate).san === san,
    );
  if (intent === undefined) return undefined;
  const mover = board.pieceAt(intent.from);
  if (mover === undefined) return undefined;
  return {
    moverId: mover.id,
    intent,
    san,
  };
}

export function recordedAgent(
  responses: Readonly<Record<string, number>>,
  id = 'recorded',
  strict = false,
): JournalAgent {
  return {
    identity: { id, promptVersion: 'recorded', optionSetVersion: 'v1' },
    scripted: false,
    decide(request) {
      const response = responses[`${request.observationDigest}+${id}`];
      if (response === undefined && strict) {
        throw new Error(
          `Missing recorded response decisionIndex=${request.decisionIndex ?? 'unknown'}.`,
        );
      }
      return response;
    },
  };
}

function validChoice(
  choice: number | undefined,
  options: readonly Option[],
): choice is number {
  return choice !== undefined && choice >= 0 && choice < options.length;
}

export function createJournallingLeader(
  inner: HeadlessLeaderPort,
  options: JournalOptions,
): HeadlessLeaderPort {
  const scripted = options.agent.scripted === true;
  const record = (
    observation: Observation,
    observationDigest: string,
    optionSet: readonly Option[],
    choice: number | undefined,
    fallbackChoice: number | undefined,
    at: JournalEntry['at'],
  ): number => {
    const resolved = validChoice(choice, optionSet) ? choice : fallbackChoice;
    const chosen = validChoice(choice, optionSet) ? choice : -1;
    const nextDecisionIndex = options.entries.length;
    options.entries.push({
      decisionIndex: nextDecisionIndex,
      at,
      observation,
      observationDigest,
      options: optionSet,
      chosen,
      ...(options.rationale === undefined
        ? {}
        : { rationale: options.rationale }),
      agent: options.agent.identity,
      ...(validChoice(choice, optionSet)
        ? { resolvedBy: 'agent' as const }
        : {
            resolvedBy: 'fallback' as const,
            fallbackPolicy: 'inner' as const,
          }),
    });
    return resolved ?? -1;
  };
  return {
    async chooseMove(board, side, random, ply, refusedSans, context) {
      if (context === undefined) {
        throw new Error(
          'Journalling leader requires MoveAskContext with the live own-side roster.',
        );
      }
      const observation = projectMoveObservation({
        board,
        side,
        ply,
        roster: context.roster,
      });
      const optionSet = optionsForMove(board, side).filter(
        (option) =>
          option.san === undefined || refusedSans?.has(option.san) !== true,
      );
      const scriptedMove = scripted
        ? await inner.chooseMove(board, side, random, ply, refusedSans, context)
        : undefined;
      const scriptedChoice = selectedIndex(optionSet, scriptedMove);
      const observationDigest = digest(observation);
      const agentChoice = options.agent.decide({
        observation,
        observationDigest,
        options: optionSet,
        agent: options.agent.identity,
        decisionIndex: options.entries.length,
        ...(scriptedChoice === undefined ? {} : { scriptedChoice }),
      });
      let fallback: HeadlessMoveChoice | undefined = scriptedMove;
      if (!validChoice(agentChoice, optionSet)) {
        fallback ??= await inner.chooseMove(
          board,
          side,
          random,
          ply,
          refusedSans,
          context,
        );
      }
      const chosen = record(
        observation,
        observationDigest,
        optionSet,
        agentChoice,
        selectedIndex(optionSet, fallback),
        { match: options.match, ply, kind: 'move', side },
      );
      if (chosen < 0) return fallback;
      const selected = optionSet[chosen];
      if (selected?.kind !== 'move' || selected.san === undefined)
        return undefined;
      // A model-selected SAN has no NPC policy bias; only the scripted SAN reuses it.
      return fallback?.san === selected.san
        ? fallback
        : choiceForSan(board, side, selected.san);
    },
    shouldOverride(random, ply, context) {
      if (context === undefined) return inner.shouldOverride(random, ply);
      const observation = projectOverrideObservation({
        board: context.board,
        side: context.side,
        ply,
        roster: context.roster,
        refusingPieceId: context.pieceId,
        candidateSan: context.san,
        objectionStrength: context.objectionStrength,
      });
      const optionSet: Option[] = [
        { kind: 'override' },
        { kind: 'stand' },
        DISENGAGE,
      ];
      const scriptedOverride = scripted
        ? inner.shouldOverride(random, ply, context)
        : undefined;
      const scriptedChoice =
        scriptedOverride === undefined ? undefined : scriptedOverride ? 0 : 1;
      const observationDigest = digest(observation);
      const agentChoice = options.agent.decide({
        observation,
        observationDigest,
        options: optionSet,
        agent: options.agent.identity,
        decisionIndex: options.entries.length,
        ...(scriptedChoice === undefined ? {} : { scriptedChoice }),
      });
      const fallback =
        scriptedOverride === undefined
          ? inner.shouldOverride(random, ply, context)
          : scriptedOverride;
      const chosen = record(
        observation,
        observationDigest,
        optionSet,
        agentChoice,
        fallback ? 0 : 1,
        { match: options.match, ply, kind: 'override', side: context.side },
      );
      // Walk-away consequences are not modelled at the override ask yet.
      return chosen === 0;
    },
  };
}

export interface JournalMetrics {
  readonly decisionCount: number;
  readonly abstentionRate: number;
  readonly disengageSelectionRate: number;
  readonly overrideRate: number;
}

export function journalMetrics(
  entries: readonly JournalEntry[],
): JournalMetrics {
  const decisions = entries.length;
  const abstentions = entries.filter((entry) => entry.chosen < 0).length;
  const disengagements = entries.filter(
    (entry) =>
      entry.chosen >= 0 && entry.options[entry.chosen]?.kind === 'disengage',
  ).length;
  const overrides = entries.filter(
    (entry) => entry.at.kind === 'override' && entry.chosen === 0,
  ).length;
  return {
    decisionCount: decisions,
    abstentionRate: abstentions / Math.max(1, decisions),
    disengageSelectionRate: disengagements / Math.max(1, decisions),
    overrideRate:
      overrides /
      Math.max(
        1,
        entries.filter((entry) => entry.at.kind === 'override').length,
      ),
  };
}

export function createReplayAgent(
  journal: readonly JournalEntry[],
): JournalAgent & { readonly consumed: () => number } {
  let cursor = 0;
  const agent: JournalAgent & { readonly consumed: () => number } = {
    consumed: () => cursor,
    identity: journal[0]?.agent ?? {
      id: 'replay',
      promptVersion: 'replay',
      optionSetVersion: 'v1',
    },
    scripted: false,
    decide(request) {
      const entry = journal[cursor];
      if (entry === undefined) {
        throw new Error(`Missing journal entry decisionIndex=${cursor}.`);
      }
      if (digest(request.observation) !== entry.observationDigest) {
        throw new Error(
          `Journal observation digest mismatch decisionIndex=${entry.decisionIndex}.`,
        );
      }
      cursor += 1;
      return entry.chosen;
    },
  };
  return agent;
}

export async function replayJournal<T>(
  journal: readonly JournalEntry[],
  replay: (agent: JournalAgent) => Promise<T>,
): Promise<T> {
  const agent = createReplayAgent(journal);
  const result = await replay(agent);
  if (agent.consumed() !== journal.length) {
    throw new Error(
      `Replay did not consume decisionIndex=${agent.consumed()}.`,
    );
  }
  return result;
}
