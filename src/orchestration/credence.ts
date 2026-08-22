import { digest } from '../core/digest';
import type { LeaderId } from '../core/ids';
import {
  clampCredence,
  defaultCredence,
  type CredenceState,
  type PieceState,
} from '../psychology';

/**
 * The spread is deliberately neutral until the owner settles the disposition
 * distribution and floor. The deterministic wiring is live behind this knob.
 */
export const DISPOSITION_SPREAD = 0;

export interface CredenceIdentity {
  readonly identityCreationSeed?: number;
  readonly disposition?: CredenceState;
  readonly relationshipAccounts?: Readonly<Record<LeaderId, CredenceState>>;
}

function digestUnit(value: unknown): number {
  const encoded = digest(value).slice(0, 8);
  return Number.parseInt(encoded, 16) / 0xffffffff;
}

function centeredOffset(value: unknown, spread: number): number {
  const boundedSpread = Math.max(0, Math.trunc(spread));
  return Math.trunc((digestUnit(value) * 2 - 1) * boundedSpread);
}

export function identityCreationSeed(
  careerSeed: number,
  identityId: string,
): number {
  return Number.parseInt(
    digest({ careerSeed, identityId, channel: 'identity-creation' }).slice(
      0,
      8,
    ),
    16,
  );
}

export function dispositionForIdentitySeed(
  seed: number,
  spread: number = DISPOSITION_SPREAD,
): CredenceState {
  const prior = defaultCredence();
  return {
    ...prior,
    tauBenev: clampCredence(
      prior.tauBenev + centeredOffset({ seed, channel: 'benevolence' }, spread),
    ),
    tauAbil: clampCredence(
      prior.tauAbil + centeredOffset({ seed, channel: 'ability' }, spread),
    ),
  };
}

export function ensureCredenceIdentity<T extends CredenceIdentity>(
  identity: T,
  fallbackSeed = 0,
): T & {
  readonly identityCreationSeed: number;
  readonly disposition: CredenceState;
  readonly relationshipAccounts: Readonly<Record<LeaderId, CredenceState>>;
} {
  const seed = identity.identityCreationSeed ?? fallbackSeed;
  return {
    ...identity,
    identityCreationSeed: seed,
    disposition: identity.disposition ?? dispositionForIdentitySeed(seed),
    relationshipAccounts: identity.relationshipAccounts ?? {},
  };
}

export function checkOutCredence(
  identity: CredenceIdentity,
  leaderId: LeaderId,
  piece: PieceState,
): PieceState {
  const channels = ensureCredenceIdentity(identity);
  const account =
    channels.relationshipAccounts[leaderId] ?? channels.disposition;
  return { ...piece, credence: { ...account } };
}

export function checkInCredence<T extends CredenceIdentity>(
  identity: T,
  leaderId: LeaderId,
  piece: PieceState,
): T {
  const channels = ensureCredenceIdentity(identity);
  return {
    ...channels,
    relationshipAccounts: {
      ...channels.relationshipAccounts,
      [leaderId]: { ...piece.credence },
    },
  };
}
