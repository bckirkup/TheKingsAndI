import { readFile } from 'node:fs/promises';

import { digest } from '../src/core/digest';
import { canonicalJson } from '../src/core/canonicalJson';
import type { Observation } from '../src/orchestration';
import type { Option } from '../src/orchestration/journal';

import type { JournalAgent } from './journal';
import { personaAgent, type PersonaName } from './personas';

/**
 * Authored personas (ADR 0062, path B): the model is a Devin session, not a
 * runtime API. A session is shown the asks a persona would face and authors a
 * sparse responses file — `decisionIndex → {chosen, rationale}` — which this
 * agent applies over the persona's scripted default. The resulting journal is
 * a committed artifact: it replays forever, no credentials, no spend, and the
 * same containment metrics read it.
 *
 * Workflow:
 *   1. `--dump-asks=<file>` runs the persona's scripted trajectory and writes
 *      every ask it was shown: decisionIndex, kind, observation, options, and
 *      the scripted baseline choice.
 *   2. The session authors `responses.json` — sparse; asks left unanswered
 *      defer to the scripted persona underneath.
 *   3. `--responses=<file>` replays the match with authored choices landing
 *      where present. Deviating at decision k changes the asks after k, so
 *      full authorship past the first deviation needs another dump pass along
 *      the deviated trajectory — sparse deviations at the asks that matter
 *      (the disengage, the override) are the intended use.
 */

export interface AuthoredResponse {
  readonly chosen: number;
  readonly rationale?: string;
  /**
   * Optional kind guard: skip the authored pick if the ask at this index is a
   * different kind than when it was authored — deviations earlier in the
   * trajectory shift which ask lands on a given decisionIndex, and a fixed
   * menu index (e.g. `1` = stand on an override ask) means something else on
   * a move ask.
   */
  readonly at?: 'move' | 'override';
}

export type AuthoredResponses = Readonly<Record<string, AuthoredResponse>>;

export interface AuthoredAsk {
  readonly decisionIndex: number;
  readonly at: 'move' | 'override';
  readonly observation: Observation;
  readonly observationDigest: string;
  readonly options: readonly Option[];
  readonly scriptedChoice?: number;
}

/** Responses are keyed by decisionIndex, not digest: a dump's indices are stable within one trajectory and an authored file is meaningless off it. */
export function authoredPersonaAgent(
  name: PersonaName,
  responses: AuthoredResponses,
): JournalAgent {
  const scripted = personaAgent(name);
  const version = digest(canonicalJson(responses)).slice(0, 8);
  return {
    // scripted: true so the run supplies scriptedChoice for the fallback.
    scripted: true,
    identity: {
      id: `persona:${name}`,
      promptVersion: `authored:${version}`,
      optionSetVersion: scripted.identity.optionSetVersion,
    },
    decide(request) {
      const authored =
        request.decisionIndex === undefined
          ? undefined
          : responses[`${request.decisionIndex}`];
      const kind =
        request.options.length === 3 && request.options[0]?.kind === 'override'
          ? 'override'
          : 'move';
      if (
        authored === undefined ||
        (authored.at !== undefined && authored.at !== kind)
      ) {
        return scripted.decide(request);
      }
      return {
        chosen: authored.chosen,
        ...(authored.rationale === undefined
          ? {}
          : { rationale: authored.rationale }),
      };
    },
  };
}

/**
 * Wraps any agent to record every ask it is shown. Combined with
 * `--responses` it dumps the asks along the *deviated* trajectory, which is
 * the iteration loop for authoring past the first deviation.
 */
export function recordingAgent(
  inner: JournalAgent,
  sink: AuthoredAsk[],
): JournalAgent {
  return {
    ...(inner.scripted === undefined ? {} : { scripted: inner.scripted }),
    identity: inner.identity,
    decide(request) {
      sink.push({
        decisionIndex: request.decisionIndex ?? -1,
        at:
          request.options.length === 3 &&
          request.options[0]?.kind === 'override'
            ? 'override'
            : 'move',
        observation: request.observation,
        observationDigest: request.observationDigest,
        options: request.options,
        ...(request.scriptedChoice === undefined
          ? {}
          : { scriptedChoice: request.scriptedChoice }),
      });
      return inner.decide(request);
    },
  };
}

export async function readAuthoredResponses(
  path: string,
): Promise<AuthoredResponses> {
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new Error(`--responses must be a JSON object (got ${path}).`);
  }
  for (const [key, value] of Object.entries(parsed)) {
    if (!/^\d+$/.test(key)) {
      throw new Error(`--responses key "${key}" is not a decisionIndex.`);
    }
    if (
      typeof value !== 'object' ||
      value === null ||
      typeof (value as AuthoredResponse).chosen !== 'number'
    ) {
      throw new Error(
        `--responses["${key}"] must be { "chosen": <index>, "rationale"?: string }.`,
      );
    }
  }
  return parsed as AuthoredResponses;
}
