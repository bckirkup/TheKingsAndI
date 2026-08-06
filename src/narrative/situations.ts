import type { CredenceBand, GrievanceKind, PersonaId, Verdict } from './types';

/**
 * Situation keys are **role-abstract** (D52, ADR 0023 §4): they name
 * relationships and events, never board objects or geometry. That is what lets a
 * content pack rename Pawn → Analyst as data (D53) without touching a key. They
 * also carry the two credence channels separately (ADR 0019) so a piece can say
 * "I know it was right, I just don't think you care."
 *
 * The reachable set is finite and enumerable, which is the whole point: coverage
 * — every reachable situation has a non-empty line — is a CI check.
 */
export type SituationKey = string;

export const PERSONAS: readonly PersonaId[] = ['plainspoken'];

export const POSITIVE_VERDICTS: readonly Verdict[] = [
  'HEROIC_EXECUTION',
  'COMPLIANT_EXECUTION',
];

export const NEGATIVE_VERDICTS: readonly Verdict[] = [
  'FATALISTIC_COMPLIANCE',
  'QUIET_QUITTING',
  'MORAL_REFUSAL',
  'DESERTION_MUTINY',
];

/**
 * Grievances a negative verdict may name. A negative verdict always names one —
 * cause is mandatory (ADR 0018) — so `NONE` never appears here.
 */
export const NEGATIVE_GRIEVANCES: readonly GrievanceKind[] = [
  'ABANDONED',
  'SPENT_PEER',
  'OVERRIDDEN',
  'NEGLECTED',
  'CLASS_CONTEMPT',
  'LOSING_STREAK',
];

export const CREDENCE_BANDS: readonly CredenceBand[] = ['LOW', 'MID', 'HIGH'];

function lower(value: string): string {
  return value.toLowerCase();
}

/**
 * The canonical, role-abstract key for a situation. Positive verdicts do not
 * vary by credence band (a piece does not execute heroically for a leader it
 * distrusts), so their key omits the channels; negative verdicts carry both.
 */
export function situationKey(input: {
  readonly verdict: Verdict;
  readonly grievance: GrievanceKind;
  readonly ability: CredenceBand;
  readonly benevolence: CredenceBand;
}): SituationKey {
  if ((POSITIVE_VERDICTS as readonly Verdict[]).includes(input.verdict)) {
    return `subordinate.${lower(input.verdict)}`;
  }
  return [
    'subordinate',
    lower(input.verdict),
    lower(input.grievance),
    `ability_${lower(input.ability)}`,
    `benevolence_${lower(input.benevolence)}`,
  ].join('.');
}

export interface ReachableSituation {
  readonly persona: PersonaId;
  readonly verdict: Verdict;
  readonly grievance: GrievanceKind;
  readonly ability: CredenceBand;
  readonly benevolence: CredenceBand;
  readonly key: SituationKey;
}

/**
 * Every situation the game can ever voice, per persona. This is the bound on
 * what a piece can express; changing it invalidates authored content, so it is
 * enumerated deliberately rather than discovered at runtime.
 */
export function reachableSituations(): ReachableSituation[] {
  const situations: ReachableSituation[] = [];
  for (const persona of PERSONAS) {
    for (const verdict of POSITIVE_VERDICTS) {
      situations.push({
        persona,
        verdict,
        grievance: 'NONE',
        ability: 'HIGH',
        benevolence: 'HIGH',
        key: situationKey({
          verdict,
          grievance: 'NONE',
          ability: 'HIGH',
          benevolence: 'HIGH',
        }),
      });
    }
    for (const verdict of NEGATIVE_VERDICTS) {
      for (const grievance of NEGATIVE_GRIEVANCES) {
        for (const ability of CREDENCE_BANDS) {
          for (const benevolence of CREDENCE_BANDS) {
            situations.push({
              persona,
              verdict,
              grievance,
              ability,
              benevolence,
              key: situationKey({ verdict, grievance, ability, benevolence }),
            });
          }
        }
      }
    }
  }
  return situations;
}
