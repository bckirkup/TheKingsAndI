import type { PieceRole } from '../psychology';

export type SituationKey =
  | 'refusal.low_trust'
  | 'refusal.expendable'
  | 'refusal.able_uncared'
  | 'refusal.no_faith'
  | 'override.forced'
  | 'override.able_uncared'
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
  // Two-channel credence (ADR 0019 / D19): the piece rates the *order* (τ_abil)
  // and the *leader's care* (τ_benev) separately, so it can say the sentence the
  // design exists for — "I know it was right, I just don't think you care."
  'refusal.able_uncared': expandForRoles([
    'I know {san} is the right move. I just do not believe you care what it costs me.',
    'Yes, {san} wins. No, I do not think you would mourn this {role}.',
    '{san} is correct and you are cold. I will not be spent by a hand that will not grieve me.',
    'The order is sound; your regard for me is not. I will not play {san}.',
    'I see exactly why {san} is right. I have also seen how little I matter to you.',
  ]),
  'refusal.no_faith': expandForRoles([
    'I trust neither the order nor the hand that gives it. Not {san}.',
    '{san} is wrong, and you have not earned the benefit of the doubt.',
    'Neither your judgment nor your care has held up. I refuse {san}.',
    'A poor move from a leader I no longer believe in: no to {san}.',
    'You ask a {role} to trust {san}. I have no faith left to give.',
  ]),
  'override.forced': expandForRoles([
    'So be it. I will play {san}, but I will remember who forced it.',
    'You overrode my refusal. {san} is on your conscience, not mine.',
    'I obey {san}. Do not ask me to trust the order was wise.',
    'The {role} moves to {san}. The wound stays.',
    'Forced {san} is still a record, Commander.',
  ]),
  'override.able_uncared': expandForRoles([
    'I play {san} because you forced it. I always knew it was right — and that you did not care.',
    'Forced to {san}. The move was sound. So was my grievance.',
    'You overrode me. {san} it is: correct, and cold.',
    'The {role} obeys {san}. I was never wrong about the move, nor about you.',
    'Fine — {san}. Right order, wrong heart. I will remember both.',
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
