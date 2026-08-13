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

/** The two credence channels at the cue site (ADR 0019), integer 0..100. */
export interface CredenceReading {
  readonly tauAbil: number;
  readonly tauBenev: number;
}

/** Cut points for the spoken credence bands. Presentation only. */
export const CREDENCE_BAND_CONFIG = { low: 34, high: 67 } as const;

export function credenceBand(
  value: number,
  config: {
    readonly low: number;
    readonly high: number;
  } = CREDENCE_BAND_CONFIG,
): 'low' | 'mid' | 'high' {
  if (value < config.low) return 'low';
  if (value < config.high) return 'mid';
  return 'high';
}

export interface NarrationRequest {
  readonly cue: DialogueCue;
  readonly pieceRole: PieceRole;
  readonly trust: number;
  readonly ply: number;
  readonly seed: number;
  /**
   * The piece's two-channel credence, when known. When present, refusals and
   * overrides refine to channel-aware lines (D19); when absent, selection falls
   * back to the single-trust bands, so callers without credence are unaffected.
   */
  readonly credence?: CredenceReading;
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
  credence?: CredenceReading,
): SituationKey {
  const abil = credence === undefined ? null : credenceBand(credence.tauAbil);
  const benev = credence === undefined ? null : credenceBand(credence.tauBenev);
  switch (cue.eventKind) {
    case 'refusal':
      if (abil === 'high' && benev === 'low') return 'refusal.able_uncared';
      if (abil === 'low' && benev === 'low') return 'refusal.no_faith';
      return trustBand(trust) === 'low'
        ? 'refusal.low_trust'
        : 'refusal.expendable';
    case 'override':
      if (abil === 'high' && benev === 'low') return 'override.able_uncared';
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
  // A per-(seed, role) base offset plus the ply, so a situation voiced again
  // this match steps to the next variant rather than risking the same line —
  // consecutive plies never repeat, and a bank is exhausted before it recurs
  // (the "no repetition within a match" rule, narrative-llm skill). Still a pure
  // function of its inputs, so replays reproduce the line byte for byte.
  const roleOffset = (pieceRole.codePointAt(0) ?? 0) * 17;
  const base = Math.abs((seed ^ roleOffset) | 0);
  const index = (base + ply) % variants.length;
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
    request.credence,
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
  return situationFor(
    request.cue,
    request.trust,
    request.cue.verdict,
    request.credence,
  );
}
