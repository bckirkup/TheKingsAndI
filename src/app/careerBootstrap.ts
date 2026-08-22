import { createSeededRandom } from '../core/random';
import { createFreshPieceState, unitForIndex } from '../orchestration/roster';
import {
  DISPOSITION_SPREAD,
  dispositionForIdentitySeed,
  identityCreationSeed,
  poolRoleCounts,
  SQUAD_CONFIG,
} from '../orchestration';
import type { PieceRole } from '../psychology';
import type {
  PieceIdentityRecord,
  StoredPieceState,
} from '../persistence/types';

export const SQUAD_NAMES = [
  'Aethelgard',
  'Baldric',
  'Caelum',
  'Drystan',
  'Elowen',
  'Fenric',
  'Gareth',
  'Helena',
  'Isolde',
  'Jorah',
  'Kestrel',
  'Leofric',
  'Mira',
  'Niall',
  'Orin',
  'Petra',
  'Quillon',
  'Rosalind',
  'Stefan',
  'Theodora',
  'Ulric',
  'Valeria',
  'Wulfric',
  'Xanthe',
  'Ysabel',
  'Zephyr',
  'Amaranth',
  'Branwen',
  'Cedric',
  'Damaris',
  'Eadric',
];

function roleOrder(): readonly PieceRole[] {
  return ['Pawn', 'Knight', 'Bishop', 'Rook', 'Queen', 'King'];
}

export function bootstrapRoster(
  seed: number,
  dispositionSpread = DISPOSITION_SPREAD,
): {
  readonly roster: StoredPieceState[];
  readonly identities: PieceIdentityRecord[];
} {
  const random = createSeededRandom(seed);
  const randomUnit = random.nextInt(10_000) / 10_000;
  const roster: StoredPieceState[] = [];
  const identities: PieceIdentityRecord[] = [];
  let index = 0;
  for (const originRole of roleOrder()) {
    const required =
      originRole === 'King'
        ? 1
        : (poolRoleCounts()[originRole] ?? 0) * SQUAD_CONFIG.POOL_DEPTH_FACTOR;
    for (let memberIndex = 0; memberIndex < required; memberIndex += 1) {
      const id = `w:${originRole}:${String(memberIndex).padStart(2, '0')}`;
      const memberUnit = unitForIndex(randomUnit, index);
      const creationSeed = identityCreationSeed(seed, id);
      const disposition = dispositionForIdentitySeed(
        creationSeed,
        dispositionSpread,
      );
      roster.push({
        ...createFreshPieceState(
          id,
          originRole,
          20,
          memberUnit,
          Math.trunc(memberUnit * 11) - 5,
        ),
        credence: disposition,
        status: 'ACTIVE',
      });
      identities.push({
        id,
        name: SQUAD_NAMES[index] ?? `Squad member ${index + 1}`,
        bornInMatch: 0,
        originRole,
        identityCreationSeed: creationSeed,
        disposition,
        relationshipAccounts: {},
      });
      index += 1;
    }
  }
  return { roster, identities };
}
