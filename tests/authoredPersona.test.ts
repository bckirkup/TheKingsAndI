import { describe, expect, it } from 'vitest';

import { OVERRIDE_OPTIONS } from '../src/orchestration/journal';
import {
  authoredPersonaAgent,
  type AuthoredResponses,
} from '../sim/authoredPersona';
import { decisionChoice, type JournalAgentRequest } from '../sim/journal';

const moveOptions = [
  { kind: 'move' as const, san: 'a3' },
  { kind: 'move' as const, san: 'a4' },
  { kind: 'disengage' as const },
];

function request(
  decisionIndex: number,
  options: typeof OVERRIDE_OPTIONS | typeof moveOptions,
): JournalAgentRequest {
  return {
    observation: { kind: 'move', ply: 0, side: 'w', fen: 'fen', roster: [] },
    observationDigest: 'digest',
    options,
    agent: { id: 't', promptVersion: 't', optionSetVersion: 'v1' },
    scriptedChoice: 0,
    decisionIndex,
  };
}

describe('authoredPersonaAgent', () => {
  it('applies authored choices with rationale and defers the rest to the scripted persona', () => {
    const responses: AuthoredResponses = {
      '1': { chosen: 1, at: 'override', rationale: 'stand down' },
    };
    const agent = authoredPersonaAgent('bored', responses);
    expect(agent.identity.id).toBe('persona:bored');
    expect(agent.identity.promptVersion).toMatch(/^authored:/);

    const authored = decisionChoice(agent.decide(request(1, OVERRIDE_OPTIONS)));
    expect(authored.chosen).toBe(1);
    expect(authored.rationale).toBe('stand down');

    // Bored persona defers to scriptedChoice before its ramp kicks in.
    const deferred = decisionChoice(agent.decide(request(0, OVERRIDE_OPTIONS)));
    expect(deferred.chosen).toBe(0);
    expect(deferred.rationale).toBeUndefined();
  });

  it('kind-guard: an override-authored index does not fire on a move ask', () => {
    const responses: AuthoredResponses = {
      '0': { chosen: 1, at: 'override', rationale: 'stale after drift' },
    };
    const agent = authoredPersonaAgent('bored', responses);
    const decision = decisionChoice(agent.decide(request(0, moveOptions)));
    // Deferred to the scripted persona (honest path → scriptedChoice = 0).
    expect(decision.chosen).toBe(0);
    expect(decision.rationale).toBeUndefined();
  });
});
