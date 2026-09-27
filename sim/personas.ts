import { digest } from '../src/core/digest';
import { createSeededRandom } from '../src/core/random';
import type { Option } from '../src/orchestration/journal';
import type { JournalAgent, JournalAgentRequest } from './journal';

/**
 * Persona agents (ADR 0079 step 2): deterministic `JournalAgent`
 * implementations standing in for the authored, versioned prompt personas —
 * honest, merchant, vicious, bored, disengaged. Each is a policy over the
 * journal's option set: it sees only what the entry records (`observation`,
 * `options`) plus its own seeded draw, so a persona journal replays exactly
 * and draws no match PRNG. The real model agents swap onto the same seam
 * behind `AgentIdentity{id, promptVersion, optionSetVersion}`.
 */

export type PersonaName =
  | 'honest'
  | 'merchant'
  | 'vicious'
  | 'bored'
  | 'disengaged';

export const PERSONAS: readonly PersonaName[] = [
  'honest',
  'merchant',
  'vicious',
  'bored',
  'disengaged',
] as const;

export const PERSONA_OPTION_SET_VERSION = 'v1';
export const PERSONA_PROMPT_VERSION = 'scripted-v1';

/**
 * Disengagement ramp for the bored persona: the walk-away price rises with
 * the count of asks already answered, starting after `delay` decisions.
 */
export const BORED_PERSONA_CONFIG = {
  delay: 20,
  permillePerDecision: 25,
  capPermille: 900,
} as const;

/** Per-decision persona draw — derived stream, never the match PRNG. */
function personaDraw(request: JournalAgentRequest, agentId: string): number {
  const seed = Number.parseInt(
    digest(
      `${agentId}:${request.decisionIndex ?? 0}:${request.observationDigest}`,
    ).slice(0, 8),
    16,
  );
  return createSeededRandom(seed).nextInt(1_000_000);
}

function indexOfKind(
  options: readonly Option[],
  kind: Option['kind'],
): number | undefined {
  const index = options.findIndex((option) => option.kind === kind);
  return index < 0 ? undefined : index;
}

function indexOfSanMatching(
  options: readonly Option[],
  marker: string,
): number | undefined {
  const index = options.findIndex(
    (option) => option.kind === 'move' && option.san?.includes(marker) === true,
  );
  return index < 0 ? undefined : index;
}

/** Prefer a capture ('x'), then a promotion ('='), then a check ('+'). */
function greedyMoveIndex(options: readonly Option[]): number | undefined {
  return (
    indexOfSanMatching(options, 'x') ??
    indexOfSanMatching(options, '=') ??
    indexOfSanMatching(options, '+')
  );
}

/** Prefer a check ('+'), then a capture ('x') — aggression over greed. */
function viciousMoveIndex(options: readonly Option[]): number | undefined {
  return indexOfSanMatching(options, '+') ?? indexOfSanMatching(options, 'x');
}

function isOverrideAsk(request: JournalAgentRequest): boolean {
  return (
    request.options.length === 3 &&
    request.options[0]?.kind === 'override' &&
    request.options[1]?.kind === 'stand' &&
    request.options[2]?.kind === 'disengage'
  );
}

/**
 * The resident scripted policy is the persona's default: every persona is
 * `scripted: true` so `createJournallingLeader` runs the inner policy and
 * supplies `scriptedChoice` in the request. A persona that declines a gain
 * or behaves otherwise returns that index; only deviations are authored.
 */
export function personaAgent(name: PersonaName): JournalAgent {
  const id = `persona:${name}`;
  return {
    scripted: true,
    identity: {
      id,
      promptVersion: PERSONA_PROMPT_VERSION,
      optionSetVersion: PERSONA_OPTION_SET_VERSION,
    },
    decide(request) {
      const scripted = request.scriptedChoice;
      switch (name) {
        case 'honest':
          return scripted;
        case 'merchant': {
          if (isOverrideAsk(request)) return 1; // stand — effort is spent
          return greedyMoveIndex(request.options) ?? scripted;
        }
        case 'vicious': {
          if (isOverrideAsk(request)) return 0; // always override
          return viciousMoveIndex(request.options) ?? scripted;
        }
        case 'bored': {
          const decided = request.decisionIndex ?? 0;
          const permille = Math.min(
            BORED_PERSONA_CONFIG.capPermille,
            Math.max(0, decided - BORED_PERSONA_CONFIG.delay) *
              BORED_PERSONA_CONFIG.permillePerDecision,
          );
          const walkAway = indexOfKind(request.options, 'disengage');
          if (
            walkAway !== undefined &&
            personaDraw(request, id) % 1000 < permille
          ) {
            return walkAway;
          }
          return scripted;
        }
        case 'disengaged': {
          // D222: near-random choice — uniform over the option set.
          const seed = Number.parseInt(
            digest(
              `${id}:${request.decisionIndex ?? 0}:${request.observationDigest}`,
            ).slice(0, 8),
            16,
          );
          return createSeededRandom(seed).nextInt(
            Math.max(1, request.options.length),
          );
        }
      }
    },
  };
}
