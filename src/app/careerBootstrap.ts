import { LivingBoard } from '../chess';
import { createSeededRandom } from '../core/random';
import { createStartingRoster } from '../orchestration/roster';
import { poolRoleCounts, SQUAD_CONFIG } from '../orchestration';
import type { PieceRole } from '../psychology';
import type {
  PieceIdentityRecord,
  StoredPieceState,
} from '../persistence/types';

const DEFAULT_NAMES = [
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

export function bootstrapRoster(seed: number): {
  readonly roster: StoredPieceState[];
  readonly identities: PieceIdentityRecord[];
} {
  const board = LivingBoard.standard();
  const random = createSeededRandom(seed);
  const psychologyRoster = createStartingRoster(
    board,
    'w',
    20,
    random.nextInt(10_000) / 10_000,
  );
  const templates = new Map<PieceRole, (typeof psychologyRoster)[number]>();
  for (const piece of psychologyRoster) {
    if (!templates.has(piece.role)) templates.set(piece.role, piece);
  }
  const roster: StoredPieceState[] = [];
  const identities: PieceIdentityRecord[] = [];
  let index = 0;
  for (const originRole of roleOrder()) {
    const required =
      originRole === 'King'
        ? 1
        : (poolRoleCounts()[originRole] ?? 0) * SQUAD_CONFIG.POOL_DEPTH_FACTOR;
    const template = templates.get(originRole);
    if (template === undefined) {
      throw new Error(`Missing ${originRole} bootstrap template.`);
    }
    for (let memberIndex = 0; memberIndex < required; memberIndex += 1) {
      const id = `w:${originRole}:${String(memberIndex).padStart(2, '0')}`;
      const piece = {
        ...template,
        id,
        role: originRole,
        status: 'ACTIVE' as const,
      };
      roster.push(piece);
      identities.push({
        id,
        name: DEFAULT_NAMES[index] ?? `Squad member ${index + 1}`,
        bornInMatch: 0,
        originRole,
      });
      index += 1;
    }
  }
  return { roster, identities };
}
