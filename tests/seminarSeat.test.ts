import { describe, expect, it } from 'vitest';

import { LivingBoard } from '../src/chess';
import { createSeededRandom } from '../src/core/random';
import { observableFromMatch } from '../sim/campaign';
import { createSimEngine, disposeSimEngine } from '../sim/engine';
import { metricsFromMatch } from '../sim/metrics';
import { runMatchFromFreshRoster } from '../sim/match';
import { createStartingRoster } from '../sim/roster';
import {
  runSeminar,
  seminarObservableFromResult,
  seminarPayload,
  seminarSummary,
} from '../sim/seminar';
import { SEMINAR_CONFIG } from '../sim/seminarConfig';

describe('seminar Judgement Seat', () => {
  it('folds a terminal seat per commander and preserves side scores', async () => {
    const result = await runSeminar({
      seed: 71,
      config: {
        ...SEMINAR_CONFIG,
        WEEKS_PER_SEMESTER: 1,
        MATCHES_PER_WEEK: 1,
        COMMANDERS_PER_COHORT: 2,
        COMMANDER_STYLE_CATALOGUE: ['supportive', 'tyrannical'],
      },
      engineKind: 'fake',
    });
    for (const commander of result.commanders) {
      expect(commander.judgementSeat).toBeDefined();
      expect(commander.judgementSeat.meanLeadershipIndex).toEqual(
        expect.any(Number),
      );
    }
    const whiteRecord = result.weeks[0]?.records['w:commander:00']?.[1];
    const blackRecord = result.weeks[0]?.records['b:commander:01']?.[0];
    expect(whiteRecord?.winScore).toBeDefined();
    expect(blackRecord?.winScore).toBeDefined();
    expect((whiteRecord?.winScore ?? 0) + (blackRecord?.winScore ?? 0)).toBe(
      100,
    );
    const supportive = result.commanders.find(
      (entry) => entry.commander.style === 'supportive',
    );
    const tyrannical = result.commanders.find(
      (entry) => entry.commander.style === 'tyrannical',
    );
    expect(supportive?.judgementSeat.meanFinalTrust).toBeGreaterThan(
      tyrannical?.judgementSeat.meanFinalTrust ?? Number.POSITIVE_INFINITY,
    );
    expect(supportive?.judgementSeat.meanLeadershipIndex).toBeGreaterThan(
      tyrannical?.judgementSeat.meanLeadershipIndex ?? Number.POSITIVE_INFINITY,
    );
    expect(seminarPayload(result)).toContain('"judgementSeat"');
    expect(seminarSummary(result)).toContain('LI=');
  });

  it('matches campaign observable semantics for a white result', async () => {
    const engine = await createSimEngine('fake');
    try {
      const result = await runMatchFromFreshRoster({
        seed: 73,
        leader: 'supportive',
        opponent: 'tyrannical',
        matchIndex: 1,
        campaignMatch: 1,
        engine,
      });
      const board = LivingBoard.standard();
      const rosterStart = createStartingRoster(
        board,
        'w',
        20,
        createSeededRandom(73).nextInt(10_000) / 10_000,
      );
      const metric = metricsFromMatch(
        1,
        73,
        'supportive',
        rosterStart,
        result,
        result.refusedGoodMoves,
      );
      expect(
        seminarObservableFromResult(
          result,
          'w',
          new Set(rosterStart.map((piece) => piece.id)),
        ),
      ).toEqual(observableFromMatch(metric, false));
    } finally {
      await disposeSimEngine('fake');
    }
  });

  it('derives observations deterministically from side-filtered events', async () => {
    const engine = await createSimEngine('fake');
    try {
      const first = await runMatchFromFreshRoster({
        seed: 79,
        leader: 'supportive',
        opponent: 'tyrannical',
        matchIndex: 1,
        campaignMatch: 1,
        engine,
      });
      const second = await runMatchFromFreshRoster({
        seed: 79,
        leader: 'supportive',
        opponent: 'tyrannical',
        matchIndex: 1,
        campaignMatch: 1,
        engine,
      });
      const ids = new Set(first.roster.map((piece) => piece.id));
      expect(seminarObservableFromResult(first, 'w', ids)).toEqual(
        seminarObservableFromResult(second, 'w', ids),
      );
      expect(seminarObservableFromResult(first, 'w', ids).matchesObserved).toBe(
        1,
      );
    } finally {
      await disposeSimEngine('fake');
    }
  });
});
