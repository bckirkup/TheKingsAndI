import type { PieceRole, MoveResponseVerdict } from '../psychology';

import { DIALOGUE_LINES, type SituationKey } from './dialogueTree';

export type { SituationKey } from './dialogueTree';

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

export interface NarrationRequest {
  readonly cue: DialogueCue;
  readonly pieceRole: PieceRole;
  readonly trust: number;
  readonly ply: number;
  readonly seed: number;
}

function trustBand(trust: number): 'low' | 'mid' | 'high' {
  if (trust < 0) return 'low';
  if (trust < 40) return 'mid';
  return 'high';
}

export function situationFor(
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
  pieceRole: PieceRole,
): string {
  const roleOffset = pieceRole.charCodeAt(0) * 17;
  const index = Math.abs(
    (seed ^ (ply * 1_000_003) ^ roleOffset) % variants.length,
  );
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
  const variants = DIALOGUE_LINES[situation];
  const template = pickVariant(
    variants,
    request.seed,
    request.ply,
    request.pieceRole,
  );
  return template.replaceAll('{san}', request.cue.san);
}

export function situationKeyFor(request: NarrationRequest): SituationKey {
  return situationFor(request.cue, request.trust, request.cue.verdict);
}
