import { comparePieceIds } from './ids';
import { createSeededRandom } from './random';

export type CohortRelationType =
  | 'served_together'
  | 'owes'
  | 'resents'
  | 'bereaved_together';

export interface CohortRelation {
  readonly from: string;
  readonly to: string;
  readonly type: CohortRelationType;
  readonly weight: number;
}

export interface CohortHistory {
  readonly intakeByMember: Readonly<Record<string, number>>;
  readonly relations: readonly CohortRelation[];
}

export interface CohortHistoryConfig {
  readonly INTAKE_SIZE: number;
  readonly RELATIONS_PER_PIECE: number;
  readonly CROSS_INTAKE_TAIL_PERMILLE: number;
  readonly WEIGHT_SERVED: number;
  readonly WEIGHT_OWES: number;
  readonly WEIGHT_RESENTS: number;
  readonly WEIGHT_BEREAVED: number;
  readonly BEREAVED_PRESTIGE_SHOVE: number;
}

/**
 * These are search seeds for the cohort-history sweep, not settled
 * relationship or prestige magnitudes. Zero density is the unchanged control.
 */
export const COHORT_HISTORY_CONFIG = {
  INTAKE_SIZE: 8,
  RELATIONS_PER_PIECE: 0,
  CROSS_INTAKE_TAIL_PERMILLE: 150,
  WEIGHT_SERVED: 20,
  WEIGHT_OWES: 15,
  WEIGHT_RESENTS: 20,
  WEIGHT_BEREAVED: 25,
  BEREAVED_PRESTIGE_SHOVE: 5,
} as const satisfies CohortHistoryConfig;

const RELATION_TYPES: readonly CohortRelationType[] = [
  'served_together',
  'owes',
  'resents',
  'bereaved_together',
];

function positiveInteger(value: number, fallback: number): number {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

function nonNegativeInteger(value: number, fallback: number): number {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function permille(value: number, fallback: number): number {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000
    ? value
    : fallback;
}

function relationWeight(
  type: CohortRelationType,
  config: CohortHistoryConfig,
): number {
  switch (type) {
    case 'served_together':
      return Math.max(0, Math.trunc(config.WEIGHT_SERVED));
    case 'owes':
      return Math.max(0, Math.trunc(config.WEIGHT_OWES));
    case 'resents':
      return Math.max(0, Math.trunc(config.WEIGHT_RESENTS));
    case 'bereaved_together':
      return Math.max(0, Math.trunc(config.WEIGHT_BEREAVED));
  }
}

function relationKey(
  from: string,
  to: string,
  type: CohortRelationType,
): string {
  return `${from}\u0000${to}\u0000${type}`;
}

export function generateCohortHistory(
  memberIds: readonly string[],
  seed: number,
  config: CohortHistoryConfig = COHORT_HISTORY_CONFIG,
): CohortHistory {
  if (!Number.isSafeInteger(seed)) {
    throw new RangeError('Cohort history seed must be a safe integer.');
  }
  const sortedIds = [...new Set(memberIds)].sort(comparePieceIds);
  const intakeSize = positiveInteger(config.INTAKE_SIZE, 1);
  const relationsPerPiece = nonNegativeInteger(config.RELATIONS_PER_PIECE, 0);
  const crossIntakeTail = permille(
    config.CROSS_INTAKE_TAIL_PERMILLE,
    COHORT_HISTORY_CONFIG.CROSS_INTAKE_TAIL_PERMILLE,
  );
  const random = createSeededRandom(seed);
  const intakeOrder = [...sortedIds];
  for (let index = intakeOrder.length - 1; index > 0; index -= 1) {
    const swapIndex = random.nextInt(index + 1);
    const current = intakeOrder[index];
    const swapped = intakeOrder[swapIndex];
    if (current === undefined || swapped === undefined) continue;
    intakeOrder[index] = swapped;
    intakeOrder[swapIndex] = current;
  }
  const intakeByMember: Record<string, number> = {};
  const intakes: string[][] = [];
  for (let index = 0; index < intakeOrder.length; index += 1) {
    const intake = Math.floor(index / intakeSize);
    const memberId = intakeOrder[index];
    if (memberId === undefined) continue;
    intakeByMember[memberId] = intake;
    const members = intakes[intake] ?? [];
    members.push(memberId);
    intakes[intake] = members;
  }
  if (relationsPerPiece === 0 || sortedIds.length < 2) {
    return { intakeByMember, relations: [] };
  }

  const relations: CohortRelation[] = [];
  const seen = new Set<string>();
  for (const from of sortedIds) {
    const intake = intakeByMember[from];
    const localMembers = intakes[intake ?? 0] ?? [];
    for (
      let relationIndex = 0;
      relationIndex < relationsPerPiece;
      relationIndex += 1
    ) {
      const source =
        random.nextInt(1_000) < crossIntakeTail ? sortedIds : localMembers;
      const possibleTargets = source.filter((candidate) => candidate !== from);
      if (possibleTargets.length === 0) continue;
      const to = possibleTargets[random.nextInt(possibleTargets.length)];
      if (to === undefined) continue;
      const type = RELATION_TYPES[random.nextInt(RELATION_TYPES.length)];
      if (type === undefined) continue;
      const weight = relationWeight(type, config);
      const forwardKey = relationKey(from, to, type);
      if (!seen.has(forwardKey)) {
        seen.add(forwardKey);
        relations.push({ from, to, type, weight });
      }
      if (type === 'served_together' || type === 'bereaved_together') {
        const reverseKey = relationKey(to, from, type);
        if (!seen.has(reverseKey)) {
          seen.add(reverseKey);
          relations.push({ from: to, to: from, type, weight });
        }
      }
    }
  }
  return { intakeByMember, relations };
}
