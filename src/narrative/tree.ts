import type {
  CredenceBand,
  GrievanceKind,
  PersonaId,
  RoleLabel,
  Verdict,
} from './types';

/**
 * The shipped dialogue tree: reviewed authored fragments, committed as data
 * exactly like art assets (ADR 0004 §2). Lines are composed from *fragments*
 * (attitude + credence colour + grievance) rather than whole sentences, because
 * whole-sentence leaves undercover the combinatorial space and repeat within a
 * match (`narrative-llm` skill, rule 2).
 */
export interface PersonaBanks {
  /** One bank per verdict; always non-empty (the coverage floor). */
  readonly attitudeCore: Readonly<Record<Verdict, readonly string[]>>;
  /** τ_abil colour. The MID band may be silent (an empty-string variant). */
  readonly abilityClause: Readonly<Record<CredenceBand, readonly string[]>>;
  /** τ_benev colour. The MID band may be silent. */
  readonly benevolenceClause: Readonly<Record<CredenceBand, readonly string[]>>;
  /** Named cause. Non-empty for every negative grievance; `NONE` is silent. */
  readonly grievanceClause: Readonly<Record<GrievanceKind, readonly string[]>>;
  /** Pre-game narrator lines keyed on the King's mandate band. */
  readonly intro: Readonly<Record<CredenceBand, readonly string[]>>;
}

export interface DialogueTree {
  readonly version: number;
  /** Role → common noun for this pack; role-abstract keys make this renamable. */
  readonly nounMap: Readonly<Record<RoleLabel, string>>;
  readonly personas: Readonly<Record<PersonaId, PersonaBanks>>;
}

const VERDICTS: readonly Verdict[] = [
  'HEROIC_EXECUTION',
  'COMPLIANT_EXECUTION',
  'FATALISTIC_COMPLIANCE',
  'QUIET_QUITTING',
  'MORAL_REFUSAL',
  'DESERTION_MUTINY',
];

const GRIEVANCES: readonly GrievanceKind[] = [
  'NONE',
  'ABANDONED',
  'SPENT_PEER',
  'OVERRIDDEN',
  'NEGLECTED',
  'CLASS_CONTEMPT',
  'LOSING_STREAK',
];

const BANDS: readonly CredenceBand[] = ['LOW', 'MID', 'HIGH'];
const ROLES: readonly RoleLabel[] = ['K', 'Q', 'R', 'B', 'N', 'P'];

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === 'string')
  );
}

function requireRecord(
  value: unknown,
  context: string,
): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new TypeError(`Dialogue tree: ${context} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function requireBank<K extends string>(
  source: Record<string, unknown>,
  keys: readonly K[],
  context: string,
): Record<K, readonly string[]> {
  const result: Record<string, readonly string[]> = {};
  for (const key of keys) {
    const bank = source[key];
    if (!isStringArray(bank)) {
      throw new TypeError(`Dialogue tree: ${context}.${key} must be string[].`);
    }
    result[key] = bank;
  }
  return result as Record<K, readonly string[]>;
}

function loadPersona(value: unknown, persona: string): PersonaBanks {
  const record = requireRecord(value, `personas.${persona}`);
  return {
    attitudeCore: requireBank(
      requireRecord(record.attitudeCore, `personas.${persona}.attitudeCore`),
      VERDICTS,
      `personas.${persona}.attitudeCore`,
    ),
    abilityClause: requireBank(
      requireRecord(record.abilityClause, `personas.${persona}.abilityClause`),
      BANDS,
      `personas.${persona}.abilityClause`,
    ),
    benevolenceClause: requireBank(
      requireRecord(
        record.benevolenceClause,
        `personas.${persona}.benevolenceClause`,
      ),
      BANDS,
      `personas.${persona}.benevolenceClause`,
    ),
    grievanceClause: requireBank(
      requireRecord(
        record.grievanceClause,
        `personas.${persona}.grievanceClause`,
      ),
      GRIEVANCES,
      `personas.${persona}.grievanceClause`,
    ),
    intro: requireBank(
      requireRecord(record.intro, `personas.${persona}.intro`),
      BANDS,
      `personas.${persona}.intro`,
    ),
  };
}

/**
 * Parse and structurally validate an untrusted value (e.g. the committed JSON)
 * into a `DialogueTree`. Throws on any missing bank so a malformed tree fails
 * loudly at load rather than producing a line with a hole in it.
 */
export function loadDialogueTree(value: unknown): DialogueTree {
  const record = requireRecord(value, 'root');
  if (typeof record.version !== 'number') {
    throw new TypeError('Dialogue tree: version must be a number.');
  }
  const nounSource = requireRecord(record.nounMap, 'nounMap');
  const nounMap: Record<string, string> = {};
  for (const role of ROLES) {
    const noun = nounSource[role];
    if (typeof noun !== 'string' || noun.length === 0) {
      throw new TypeError(
        `Dialogue tree: nounMap.${role} must be a non-empty string.`,
      );
    }
    nounMap[role] = noun;
  }
  const personaSource = requireRecord(record.personas, 'personas');
  const personas: Record<string, PersonaBanks> = {};
  for (const [persona, banks] of Object.entries(personaSource)) {
    personas[persona] = loadPersona(banks, persona);
  }
  if (personas.plainspoken === undefined) {
    throw new TypeError('Dialogue tree: the plainspoken persona is required.');
  }
  return {
    version: record.version,
    nounMap: nounMap as Record<RoleLabel, string>,
    personas: personas as Record<PersonaId, PersonaBanks>,
  };
}
