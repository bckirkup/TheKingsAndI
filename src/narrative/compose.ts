import { NARRATION_CONFIG } from './config';
import { sanitizeName } from './sanitize';
import { POSITIVE_VERDICTS, situationKey } from './situations';
import type { DialogueTree, PersonaBanks } from './tree';
import type { PieceLineContext, Verdict } from './types';

/**
 * Deterministic leaf selection and fragment composition. Selection is a pure
 * function of `(situation, seed, repeatCount)` plus a per-bank salt, so a replay
 * reproduces every line byte for byte (`narrative-llm` skill). Nothing here
 * consumes a clock or `Math.random`.
 */

const HASH_PRIME = 0x0100_0193;
const HASH_OFFSET = 0x811c_9dc5;

/** FNV-1a over UTF-16 code units; integer-only, stable across engines. */
function hash32(input: string): number {
  let value = HASH_OFFSET >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    const unit = input.charCodeAt(index);
    value = Math.imul(value ^ (unit & 0xff), HASH_PRIME) >>> 0;
    value = Math.imul(value ^ (unit >>> 8), HASH_PRIME) >>> 0;
  }
  return value >>> 0;
}

/**
 * Choose a variant from a bank. The starting offset is fixed by the situation,
 * the seed, and a per-bank salt; `repeatCount` then rotates through the bank so
 * the same situation voiced again this match does not repeat until the bank is
 * exhausted.
 */
export function pickVariant(
  variants: readonly string[],
  seed: number,
  keyString: string,
  salt: string,
  repeatCount: number,
): string {
  if (variants.length === 0) return '';
  const base = hash32(`${seed}|${keyString}|${salt}`);
  const rotation =
    ((base % variants.length) + (repeatCount % variants.length)) %
    variants.length;
  return variants[rotation] ?? '';
}

function personaBanks(tree: DialogueTree, persona: string): PersonaBanks {
  const banks = tree.personas[persona as keyof typeof tree.personas];
  if (banks === undefined) {
    throw new RangeError(
      `No authored persona "${persona}" in the dialogue tree.`,
    );
  }
  return banks;
}

function isPositive(verdict: Verdict): boolean {
  return (POSITIVE_VERDICTS as readonly Verdict[]).includes(verdict);
}

function substitute(
  fragment: string,
  context: PieceLineContext,
  tree: DialogueTree,
): string {
  if (!fragment.includes('{')) return fragment;
  const targetName =
    context.target !== undefined
      ? sanitizeName(context.target.name, NARRATION_CONFIG.maxNameLength)
      : 'a comrade';
  const targetRole =
    context.target !== undefined ? tree.nounMap[context.target.role] : 'piece';
  return fragment
    .replaceAll('{target}', targetName)
    .replaceAll('{targetRole}', targetRole);
}

/** Compose a single piece line from the tree for the given context. */
export function composePieceLine(
  tree: DialogueTree,
  context: PieceLineContext,
): string {
  const banks = personaBanks(tree, context.persona);
  const key = situationKey({
    verdict: context.verdict,
    grievance: context.grievance,
    ability: context.credence.ability,
    benevolence: context.credence.benevolence,
  });
  const fragments: string[] = [];

  fragments.push(
    pickVariant(
      banks.attitudeCore[context.verdict],
      context.seed,
      key,
      'attitude',
      context.repeatCount,
    ),
  );

  if (!isPositive(context.verdict)) {
    fragments.push(
      pickVariant(
        banks.abilityClause[context.credence.ability],
        context.seed,
        key,
        'ability',
        context.repeatCount,
      ),
    );
    fragments.push(
      pickVariant(
        banks.benevolenceClause[context.credence.benevolence],
        context.seed,
        key,
        'benevolence',
        context.repeatCount,
      ),
    );
  }

  const grievance = pickVariant(
    banks.grievanceClause[context.grievance],
    context.seed,
    key,
    'grievance',
    context.repeatCount,
  );
  fragments.push(substitute(grievance, context, tree));

  return fragments
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length > 0)
    .join(' ');
}
