import type { PieceRole } from '../psychology';

import dialoguePack from './packs/military/dialogue.json';

export type SituationKey = keyof typeof dialoguePack.situations;

const ROLES: readonly PieceRole[] = [
  'Pawn',
  'Knight',
  'Bishop',
  'Rook',
  'Queen',
  'King',
];

function expandForRoles(stems: readonly string[]): readonly string[] {
  const lines: string[] = [];
  for (const role of ROLES) {
    for (const stem of stems) {
      lines.push(stem.replaceAll('{role}', role));
    }
  }
  return lines;
}

function expandSituations(
  situations: Record<SituationKey, readonly string[]>,
): Record<SituationKey, readonly string[]> {
  const expanded = {} as Record<SituationKey, readonly string[]>;
  for (const key of Object.keys(situations) as SituationKey[]) {
    expanded[key] = expandForRoles(situations[key]);
  }
  return expanded;
}

/** Authored dialogue leaves expanded per role from the active pack (M4.5, ADR 0023). */
export const DIALOGUE_LINES: Record<SituationKey, readonly string[]> =
  expandSituations(dialoguePack.situations);

export function totalDialogueLineCount(): number {
  return Object.values(DIALOGUE_LINES).reduce(
    (sum, lines) => sum + lines.length,
    0,
  );
}

export function allSituationKeys(): readonly SituationKey[] {
  return Object.keys(DIALOGUE_LINES) as SituationKey[];
}
