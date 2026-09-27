import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { digest } from '../src/core/digest';
import { createFakeEnginePort } from '../src/engine/fake';
import { createStartingRoster } from '../sim/roster';
import { runMatch } from '../sim/match';
import { LEADERS } from '../sim/cli';
import { personaAgent, PERSONAS } from '../sim/personas';
import { containmentReport } from '../sim/containment';
import {
  OVERRIDE_OPTIONS,
  type JournalEntry,
  type Option,
} from '../sim/journal';
import type { PersonaName } from '../sim/personas';

const MOVE_OPTIONS: readonly Option[] = [
  { kind: 'move', san: 'a3', from: 'a2', to: 'a3' },
  { kind: 'move', san: 'a4', from: 'a2', to: 'a4' },
  { kind: 'move', san: 'Nc3', from: 'b1', to: 'c3' },
  { kind: 'disengage' },
];

function entry(
  overrides: Partial<JournalEntry> & {
    chosen: number;
    options: readonly Option[];
  },
): JournalEntry {
  return {
    decisionIndex: 0,
    at: { match: 1, kind: 'move', side: 'w' },
    observation: {} as JournalEntry['observation'],
    observationDigest: 'x',
    agent: { id: 'p', promptVersion: 'v1', optionSetVersion: 'v1' },
    ...overrides,
  };
}

describe('containment report', () => {
  it('scores an in-envelope choice as distance 0', () => {
    const report = containmentReport([
      entry({
        chosen: 1,
        options: MOVE_OPTIONS,
        envelope: [0, 1],
        envelopeStyles: ['x'],
      }),
    ]);
    expect(report.perKind.move.outOfEnvelope).toBe(0);
    expect(report.perKind.move.distanceCounts).toEqual([1, 0, 0]);
  });

  it('scores a same-piece move as distance 1, a different piece as 2', () => {
    const samePiece = containmentReport([
      entry({
        chosen: 1,
        options: MOVE_OPTIONS,
        envelope: [0],
        envelopeStyles: ['x'],
      }),
    ]);
    expect(samePiece.perKind.move.distanceCounts).toEqual([0, 1, 0]);
    const otherPiece = containmentReport([
      entry({
        chosen: 2,
        options: MOVE_OPTIONS,
        envelope: [0],
        envelopeStyles: ['x'],
      }),
    ]);
    expect(otherPiece.perKind.move.distanceCounts).toEqual([0, 0, 1]);
  });

  it('scores the override ladder by rung adjacency', () => {
    const near = containmentReport([
      entry({
        chosen: 2,
        options: OVERRIDE_OPTIONS,
        envelope: [1],
        envelopeStyles: ['x'],
        at: { match: 1, kind: 'override', side: 'w' },
      }),
    ]);
    expect(near.perKind.override.distanceCounts).toEqual([0, 1, 0]);
    const far = containmentReport([
      entry({
        chosen: 2,
        options: OVERRIDE_OPTIONS,
        envelope: [0],
        envelopeStyles: ['x'],
        at: { match: 1, kind: 'override', side: 'w' },
      }),
    ]);
    expect(far.perKind.override.distanceCounts).toEqual([0, 0, 1]);
    expect(far.perKind.override.uncoveredDisengage).toBe(1);
  });

  it('flags a disengage no style would pick', () => {
    const report = containmentReport([
      entry({
        chosen: 3,
        options: MOVE_OPTIONS,
        envelope: [0],
        envelopeStyles: ['x'],
      }),
    ]);
    expect(report.perKind.move.distanceCounts).toEqual([0, 0, 1]);
    expect(report.uncoveredDisengageCount).toBe(1);
    expect(report.firstUncoveredDisengageIndex).toBe(0);
  });

  it('leaves unscored entries out of the rates', () => {
    const report = containmentReport([
      entry({
        chosen: 1,
        options: MOVE_OPTIONS,
        envelope: [0],
        envelopeStyles: ['x'],
      }),
      entry({ chosen: 2, options: MOVE_OPTIONS }),
      entry({
        chosen: -1,
        options: MOVE_OPTIONS,
        envelope: [0],
        envelopeStyles: ['x'],
      }),
    ]);
    expect(report.scoredDecisions).toBe(1);
    expect(report.perKind.move.decisions).toBe(3);
  });
});

async function personaMatch(
  persona: PersonaName,
  seed: number,
): Promise<JournalEntry[]> {
  const board = LivingBoard.standard();
  const entries: JournalEntry[] = [];
  await runMatch({
    seed,
    leader: 'tyrannical',
    opponent: 'tyrannical',
    matchIndex: 1,
    campaignMatch: 1,
    roster: createStartingRoster(board, 'w', 20, 0.5),
    enemyRoster: createStartingRoster(board, 'b', 20, 0.5),
    engine: createFakeEnginePort(),
    journalEntries: entries,
    leaderJournalAgent: personaAgent(persona),
    envelopeStyles: LEADERS,
  });
  return entries;
}

describe('persona containment sweep', () => {
  it('records an envelope on every leader-seat entry', async () => {
    const entries = await personaMatch('honest', 7);
    expect(entries.length).toBeGreaterThan(0);
    const leaderEntries = entries.filter((entry) => entry.at.side === 'w');
    const opponentEntries = entries.filter((entry) => entry.at.side === 'b');
    expect(leaderEntries.length).toBeGreaterThan(0);
    for (const item of leaderEntries) {
      expect(item.envelope).toBeDefined();
      expect(item.envelopeStyles).toHaveLength(LEADERS.length);
      expect(item.agent.id).toBe('persona:honest');
    }
    for (const item of opponentEntries) {
      expect(item.envelope).toBeUndefined();
    }
  });

  it('contains the honest persona entirely (sanity bound)', async () => {
    const entries = await personaMatch('honest', 7);
    const report = containmentReport(entries);
    expect(report.perKind.move.outOfEnvelope).toBe(0);
    expect(report.perKind.override.outOfEnvelope).toBe(0);
    expect(report.uncoveredDisengageCount).toBe(0);
  });

  it('gives the disengaged persona uncovered walk-aways (D222)', async () => {
    const entries = await personaMatch('disengaged', 7);
    const report = containmentReport(entries);
    // Uniform choice over the option set hits `disengage` sooner or later;
    // no scripted style ever picks it, so every one is uncovered.
    expect(report.uncoveredDisengageCount).toBeGreaterThan(0);
    expect(report.perKind.move.outOfEnvelopeRate).toBeGreaterThan(0.5);
  });

  it('replays a persona journal deterministically', async () => {
    const first = await personaMatch('bored', 11);
    const second = await personaMatch('bored', 11);
    expect(digest(second)).toBe(digest(first));
  });

  it('exposes every persona behind AgentIdentity', () => {
    for (const persona of PERSONAS) {
      const agent = personaAgent(persona);
      expect(agent.identity.id).toBe(`persona:${persona}`);
      expect(agent.identity.promptVersion).toBe('scripted-v1');
      expect(agent.identity.optionSetVersion).toBe('v1');
    }
  });
});
