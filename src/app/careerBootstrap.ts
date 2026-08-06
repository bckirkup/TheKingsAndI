import { LivingBoard } from '../chess';
import { createSeededRandom } from '../core/random';
import { createStartingRoster } from '../orchestration/roster';
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
];

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
  const roster = psychologyRoster.map((piece) => ({
    ...piece,
    status: 'ACTIVE' as const,
  }));
  const identities = roster.map((piece, index) => ({
    id: piece.id,
    name: DEFAULT_NAMES[index % DEFAULT_NAMES.length] ?? piece.id,
    bornInMatch: 0,
    originRole: piece.role,
  }));
  return { roster, identities };
}
