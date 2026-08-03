import { canonicalJson } from './canonicalJson';

/**
 * Deterministic content digest over canonical JSON.
 *
 * FNV-1a, run twice with different offset bases and folded into 16 hex digits.
 * Integer operations only (`Math.imul`, shifts, xor): the psychology and chess
 * layers ban transcendentals because JS engines disagree in the last bits
 * (ADR 0032 §4), and a digest that disagreed across browsers would be worse
 * than useless — it is the value that says whether a replay diverged.
 *
 * This is a fingerprint, not a MAC. Anything that must resist forgery (the
 * Certificate of Completion, ADR 0029) needs a real signature instead.
 */

const PRIME = 0x0100_0193;
const OFFSET_A = 0x811c_9dc5;
const OFFSET_B = 0x9e37_79b9;

function fnv1a(input: string, offset: number): number {
  let hash = offset >>> 0;
  for (let index = 0; index < input.length; index += 1) {
    const unit = input.charCodeAt(index);
    // Hash both halves of the code unit so that surrogate pairs and
    // above-Latin-1 characters cannot collide with their low bytes.
    hash = Math.imul(hash ^ (unit & 0xff), PRIME) >>> 0;
    hash = Math.imul(hash ^ (unit >>> 8), PRIME) >>> 0;
  }
  return hash >>> 0;
}

function hex32(value: number): string {
  return (value >>> 0).toString(16).padStart(8, '0');
}

/** 16 lowercase hex digits, stable across engines and platforms. */
export function digest(value: unknown): string {
  const encoded = canonicalJson(value);
  return `${hex32(fnv1a(encoded, OFFSET_A))}${hex32(fnv1a(encoded, OFFSET_B))}`;
}
