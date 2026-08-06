import type { PieceRole, MoveResponseVerdict } from '../psychology';

export interface DialogueCue {
  readonly eventKind:
    | 'refusal'
    | 'override'
    | 'desertion'
    | 'quiet_quit'
    | 'compliant'
    | 'heroic'
    | 'rout';
  readonly pieceId: string;
  readonly san: string;
  readonly verdict?: MoveResponseVerdict;
}

export type SituationKey =
  | 'refusal.low_trust'
  | 'refusal.expendable'
  | 'override.forced'
  | 'desertion.mutiny'
  | 'quiet_quit.compliance'
  | 'compliant.order'
  | 'heroic.sacrifice'
  | 'rout.cascade';

export interface NarrationRequest {
  readonly cue: DialogueCue;
  readonly pieceRole: PieceRole;
  readonly trust: number;
  readonly ply: number;
  readonly seed: number;
}

const LINES: Record<SituationKey, readonly string[]> = {
  'refusal.low_trust': [
    'I will not take {san}. You have not earned that order.',
    'No. Not after how you have led on this file.',
    'Ask someone who still trusts your judgment for {san}.',
  ],
  'refusal.expendable': [
    'You see a win; I see a funeral. Find another way than {san}.',
    '{san} spends me cheaply. I refuse to be expendable.',
    'Your plan needs a sacrifice. It will not be me.',
  ],
  'override.forced': [
    'So be it. I will play {san}, but I will remember who forced it.',
    'You overrode my refusal. {san} is on your conscience, not mine.',
    'I obey {san}. Do not ask me to trust the order was wise.',
  ],
  'desertion.mutiny': [
    'I leave the board. Command {san} yourself.',
    'This army no longer deserves my square. I am done.',
    'You demanded {san}. I answer by walking off.',
  ],
  'quiet_quit.compliance': [
    'I play {san}. Do not expect my best.',
    '{san}, as ordered. My heart is not in it.',
    'A hollow yes: {san}.',
  ],
  'compliant.order': [
    '{san}. As you command.',
    'Moving to {san}.',
    'Understood. {san}.',
  ],
  'heroic.sacrifice': [
    'For the King — {san}!',
    'If it must be me, then {san} with honor.',
    'I see the danger and accept {san}.',
  ],
  'rout.cascade': [
    'The line breaks. Who is left to command?',
    'One by one they leave. The rout is real.',
    'There is no army left to order.',
  ],
};

function trustBand(trust: number): 'low' | 'mid' | 'high' {
  if (trust < 0) return 'low';
  if (trust < 40) return 'mid';
  return 'high';
}

function situationFor(
  cue: DialogueCue,
  trust: number,
  verdict?: MoveResponseVerdict,
): SituationKey {
  switch (cue.eventKind) {
    case 'refusal':
      return trustBand(trust) === 'low'
        ? 'refusal.low_trust'
        : 'refusal.expendable';
    case 'override':
      return 'override.forced';
    case 'desertion':
      return 'desertion.mutiny';
    case 'quiet_quit':
      return 'quiet_quit.compliance';
    case 'heroic':
      return 'heroic.sacrifice';
    case 'rout':
      return 'rout.cascade';
    case 'compliant':
    default:
      return verdict === 'HEROIC_EXECUTION'
        ? 'heroic.sacrifice'
        : 'compliant.order';
  }
}

function pickVariant(
  variants: readonly string[],
  seed: number,
  ply: number,
): string {
  const index = Math.abs((seed ^ (ply * 1_000_003)) % variants.length);
  return variants[index] ?? variants[0] ?? '';
}

export function sanitizePieceLabel(label: string): string {
  const trimmed = label.trim().slice(0, 32);
  return [...trimmed]
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code >= 32 && code !== 127;
    })
    .join('');
}

export function lineFor(request: NarrationRequest): string {
  const situation = situationFor(
    request.cue,
    request.trust,
    request.cue.verdict,
  );
  const template = pickVariant(LINES[situation], request.seed, request.ply);
  return template.replaceAll('{san}', request.cue.san);
}

export function situationKeyFor(request: NarrationRequest): SituationKey {
  return situationFor(request.cue, request.trust, request.cue.verdict);
}
