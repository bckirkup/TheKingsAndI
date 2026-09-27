import { digest } from '../core/digest';
import { compareCodeUnits } from '../core/canonicalJson';
import { extractMoveFeatures, type LivingBoard, type Side } from '../chess';
import type { Observation } from './observation';

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

export const DISENGAGE: Option = { kind: 'disengage' };

/** The override ask's fixed option set (ADR 0062): override, stand, walk away. */
export const OVERRIDE_OPTIONS: readonly Option[] = [
  { kind: 'override' },
  { kind: 'stand' },
  DISENGAGE,
];

export function optionsForMove(board: LivingBoard, side: Side): Option[] {
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

/** Identity stamped on decisions a human made at the GUI (ADR 0079 D219). */
export function humanAgent(id = 'human'): AgentIdentity {
  return { id, promptVersion: 'human', optionSetVersion: 'v1' };
}

export function appendJournalEntry(input: {
  readonly entries: JournalEntry[];
  readonly at: JournalEntry['at'];
  readonly observation: Observation;
  readonly options: readonly Option[];
  readonly chosen: number;
  readonly agent: AgentIdentity;
  readonly rationale?: string;
  readonly resolvedBy?: 'agent' | 'fallback';
}): JournalEntry {
  const entry: JournalEntry = {
    decisionIndex: input.entries.length,
    at: input.at,
    observation: input.observation,
    observationDigest: digest(input.observation),
    options: input.options,
    chosen: input.chosen,
    ...(input.rationale === undefined ? {} : { rationale: input.rationale }),
    agent: input.agent,
    ...(input.resolvedBy === 'fallback'
      ? { resolvedBy: 'fallback' as const, fallbackPolicy: 'inner' as const }
      : { resolvedBy: 'agent' as const }),
  };
  input.entries.push(entry);
  return entry;
}
