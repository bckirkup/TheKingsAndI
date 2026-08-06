import type { PieceRole } from '../psychology';

export type SituationKey =
  | 'refusal.low_trust'
  | 'refusal.expendable'
  | 'override.forced'
  | 'desertion.mutiny'
  | 'quiet_quit.compliance'
  | 'compliant.order'
  | 'heroic.sacrifice'
  | 'rout.cascade';

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

/** Authored dialogue leaves — ~200 lines across situations and roles (M4.5). */
export const DIALOGUE_LINES: Record<SituationKey, readonly string[]> = {
  'refusal.low_trust': expandForRoles([
    'I will not take {san}. You have not earned that order, Commander.',
    'No, {role}. Not {san} — not after how you have led on this file.',
    'Ask someone who still trusts your judgment for {san}.',
    'My trust is gone. {san} is your problem, not mine.',
    '{san}? You would spend my square and call it strategy.',
  ]),
  'refusal.expendable': expandForRoles([
    'You see a win; I see a funeral. Find another way than {san}.',
    '{san} spends the {role} cheaply. I refuse to be expendable.',
    'Your plan needs a sacrifice. It will not be this {role}.',
    'I am not the price of your {san}.',
    'Command {san} from someone you have not already burned.',
  ]),
  'override.forced': expandForRoles([
    'So be it. I will play {san}, but I will remember who forced it.',
    'You overrode my refusal. {san} is on your conscience, not mine.',
    'I obey {san}. Do not ask me to trust the order was wise.',
    'The {role} moves to {san}. The wound stays.',
    'Forced {san} is still a record, Commander.',
  ]),
  'desertion.mutiny': expandForRoles([
    'I leave the board. Command {san} yourself.',
    'This army no longer deserves my square after {san}. I am done.',
    'You demanded {san}. I answer by walking off.',
    'A {role} who will not be spent walks away.',
    'No more orders. Especially not {san}.',
  ]),
  'quiet_quit.compliance': expandForRoles([
    'I play {san}. Do not expect my best.',
    '{san}, as ordered. My heart is not in it.',
    'A hollow yes: {san}.',
    'The {role} complies. That is all.',
    '{san} — technically legal, spiritually absent.',
  ]),
  'compliant.order': expandForRoles([
    '{san}. As you command.',
    'Moving to {san}.',
    'Understood. {san}.',
    'The {role} advances: {san}.',
    'Acknowledged — {san}.',
  ]),
  'heroic.sacrifice': expandForRoles([
    'For the King — {san}!',
    'If it must be this {role}, then {san} with honor.',
    'I see the danger and accept {san}.',
    'Take my square if you must — {san}!',
    'This {role} will pay the price: {san}.',
  ]),
  'rout.cascade': expandForRoles([
    'The line breaks after {san}. Who is left to command?',
    'One by one they leave. The rout is real — last order was {san}.',
    'There is no army left to play {san}.',
    'Even the {role}s are gone. It is over.',
    'Command an empty file if you can — {san} was the last straw.',
  ]),
};

export function totalDialogueLineCount(): number {
  return Object.values(DIALOGUE_LINES).reduce(
    (sum, lines) => sum + lines.length,
    0,
  );
}

export function allSituationKeys(): readonly SituationKey[] {
  return Object.keys(DIALOGUE_LINES) as SituationKey[];
}
