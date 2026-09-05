import { describe, expect, it } from 'vitest';

import { ENGINE_CONFIG } from '../src/psychology/config';
import {
  buildIncidenceTable,
  buildDiagnostics,
  parseEmotionCensusArgs,
  runEmotionCensus,
  withPatchedEngineConfig,
} from '../sim/emotionCensus';
import type { MatchEvent } from '../src/psychology';

describe('emotion census helpers', () => {
  it('counts diagnostic events and settlement/pride inputs', () => {
    const events: MatchEvent[] = [
      {
        t: 'MOVE',
        ply: 1,
        san: 'e4',
        pieceId: 'p',
        verdict: 'COMPLIANT_EXECUTION',
      },
      {
        t: 'OVERRIDE',
        ply: 2,
        pieceId: 'p',
        san: 'e5',
        pieceTrustDelta: -1,
        vindicated: true,
      },
      {
        t: 'OVERRIDE',
        ply: 3,
        pieceId: 'q',
        san: 'Qh5',
        pieceTrustDelta: -2,
      },
      {
        t: 'REFUSAL',
        ply: 4,
        pieceId: 'p',
        utility: 1,
        threshold: 2,
        perceivedValue: 1,
        justified: true,
      },
      {
        t: 'REFUSAL',
        ply: 5,
        pieceId: 'q',
        utility: 1,
        threshold: 2,
        perceivedValue: 0,
        justified: false,
      },
      {
        t: 'DESERTION',
        ply: 6,
        pieceId: 'p',
        refusedMove: 'e6',
        uStay: 1,
        uDesert: 2,
        terms: {
          P_captured: 0.5,
          pain: 1,
          P_lossIfStay: 1,
          P_lossIfLeave: 2,
          pivotality: 0.75,
          lambda: 1,
          lambdaTrust: 1,
          lambdaMorale: 1,
          lambdaLoyalty: 1,
          lambdaAffinity: 1,
          standingCost: 1,
          gloryWeight: 1,
          tauBenev: 1,
          tauAbil: 1,
        },
        departureKind: 'first',
      },
      { t: 'CAPTURE', ply: 7, victim: 'p', by: 'q' },
      { t: 'HEROISM_NOMINATION', ply: 8, pieceId: 'q', san: 'Qh7' },
      {
        t: 'BITTERNESS_FORMED',
        pieceId: 'q',
        trigger: 'rupture_floor',
        bitternessPermille: 500,
      },
      {
        t: 'PANIC_ONSET',
        ply: 9,
        side: 'w',
        trigger: 'dread',
        dreading: ['p'],
        fielded: 2,
      },
      {
        t: 'RELIEF',
        ply: 10,
        pieceId: 'p',
        priorRiskPermille: 800,
        riskPermille: 200,
      },
    ];
    const diagnostics = buildDiagnostics({
      records: [{ ownerId: 'w:commander:00', rosterSize: 4, events }],
      commanders: [{ id: 'w:commander:00', style: 'supportive' }],
      settlements: [
        {
          cycle: 1,
          ownerId: 'w:commander:00',
          side: 'w',
          pieceId: 'p',
          role: 'Pawn',
          clearingPrice: 10,
        },
        {
          cycle: 1,
          ownerId: 'w:commander:00',
          side: 'w',
          pieceId: 'q',
          role: 'Pawn',
          clearingPrice: 15,
        },
      ],
      prideEvents: [
        {
          cycle: 1,
          kind: 'ransom',
          ownerId: 'w:commander:00',
          pieceId: 'p',
          role: 'Pawn',
          price: 10,
        },
        {
          cycle: 1,
          kind: 'draft',
          ownerId: 'w:commander:00',
          pieceId: 'q',
          role: 'Pawn',
          price: 15,
        },
      ],
    });
    expect(diagnostics.byStyle.supportive).toMatchObject({
      records: 1,
      move: 1,
      override: 2,
      overrideVindicated: 1,
      overrideUnvindicated: 1,
      refusal: 2,
      refusalJustified: 1,
      refusalUnjustified: 1,
      refusalPerceivedValueAtLeastOne: 1,
      desertion: 1,
      desertionWithPivotality: 1,
      desertionMaxPivotality: 0.75,
      capture: 1,
      heroismNomination: 1,
      bitternessFormed: 1,
      panicOnset: 1,
      relief: 1,
      meanFieldedRoster: 4,
    });
    expect(diagnostics.draftSettlements).toMatchObject({
      totalSettlements: 2,
      groupsWithAtLeastTwoLots: 1,
      groupsWithPositiveSpread: 1,
      maxSpread: 5,
    });
    expect(diagnostics.prideEvents).toEqual({
      total: 2,
      ransom: 1,
      draft: 1,
    });
  });

  it('builds per-style incidence rows with distinct match and piece counts', () => {
    const table = buildIncidenceTable(
      [
        {
          commanderId: 'w:commander:00',
          week: 1,
          match: 1,
          pieceId: 'a',
        },
        {
          commanderId: 'w:commander:00',
          week: 1,
          match: 1,
          pieceId: 'b',
        },
        {
          commanderId: 'b:commander:00',
          week: 1,
          pieceId: 'a',
        },
      ],
      [
        { id: 'w:commander:00', style: 'supportive' },
        { id: 'b:commander:00', style: 'supportive' },
        { id: 'w:commander:01', style: 'tyrannical' },
      ],
      2,
      2,
    );
    expect(table.supportive).toEqual({
      commanders: 2,
      matches: 8,
      named: 3,
      matchesWithNaming: 2,
      pieces: 2,
      perMatch: 3 / 8,
    });
    expect(table.tyrannical).toEqual({
      commanders: 1,
      matches: 4,
      named: 0,
      matchesWithNaming: 0,
      pieces: 0,
      perMatch: 0,
    });
  });

  it('parses defaults and rejects unsupported or malformed flags', () => {
    const defaults = parseEmotionCensusArgs([]);
    expect(defaults).toMatchObject({
      seed: 0,
      weeks: 4,
      matches: 2,
      commanders: 2,
      engine: 'fake',
      panicFloor: ENGINE_CONFIG.PANIC_ROSTER_FLOOR,
      relief: ENGINE_CONFIG.RELIEF_CAPTURE_RISK_PERMILLE,
      guiltSafetyFloor: ENGINE_CONFIG.GUILT_PEER_SAFETY_FLOOR,
      prideRefusalScale: ENGINE_CONFIG.PRIDE_REFUSAL_SCALE,
    });
    expect(defaults.catalogue).toEqual([
      'servant',
      'supportive',
      'tyrannical',
      'volatile',
      'random',
      'steady',
    ]);
    expect(
      parseEmotionCensusArgs(['--guilt-safety-floor=0.05']).guiltSafetyFloor,
    ).toBe(0.05);
    expect(
      parseEmotionCensusArgs(['--pride-refusal-scale=250']).prideRefusalScale,
    ).toBe(250);
    expect(() => parseEmotionCensusArgs(['--unknown=1'])).toThrow(
      'Unrecognised flag',
    );
    expect(() => parseEmotionCensusArgs(['--weeks=bad'])).toThrow(
      'positive integer',
    );
  });

  it('reports seminar outcomes and preserves them without pricing events', async () => {
    const base = {
      seed: 3,
      weeks: 1,
      matches: 1,
      commanders: 1,
      catalogue: ['supportive'] as const,
      engine: 'fake' as const,
      out: undefined,
      panicFloor: ENGINE_CONFIG.PANIC_ROSTER_FLOOR,
      relief: ENGINE_CONFIG.RELIEF_CAPTURE_RISK_PERMILLE,
      guiltSafetyFloor: ENGINE_CONFIG.GUILT_PEER_SAFETY_FLOOR,
    };
    const control = await runEmotionCensus({
      ...base,
      prideRefusalScale: 0,
    });
    const priced = await runEmotionCensus({
      ...base,
      prideRefusalScale: 250,
    });
    expect(control.diagnostics.byStyle.supportive?.outcome).toMatchObject({
      commanderMatches: 2,
      meanWinScore: expect.any(Number),
      meanLeadershipIndex: expect.any(Number),
      meanRefusalRate: expect.any(Number),
      meanOverrideRate: expect.any(Number),
      meanDesertions: expect.any(Number),
      meanQuietQuitRate: expect.any(Number),
      meanTrustFinal: expect.any(Number),
      meanSelfAppraisalPricedPieces: 0,
      pricedPieces: 0,
      positiveSelfAppraisalPieces: 0,
    });
    expect(control.diagnostics.prideEvents.total).toBe(0);
    expect(priced.diagnostics.byStyle.supportive?.outcome).toEqual(
      control.diagnostics.byStyle.supportive?.outcome,
    );
  });

  it('restores patched engine configuration after the callback', () => {
    const original = ENGINE_CONFIG.PANIC_ROSTER_FLOOR;
    expect(
      withPatchedEngineConfig({ PANIC_ROSTER_FLOOR: original + 7 }, () => {
        expect(ENGINE_CONFIG.PANIC_ROSTER_FLOOR).toBe(original + 7);
        return 'done';
      }),
    ).toBe('done');
    expect(ENGINE_CONFIG.PANIC_ROSTER_FLOOR).toBe(original);
    expect(() =>
      withPatchedEngineConfig({ PANIC_ROSTER_FLOOR: original + 7 }, () => {
        throw new Error('callback failed');
      }),
    ).toThrow('callback failed');
    expect(ENGINE_CONFIG.PANIC_ROSTER_FLOOR).toBe(original);
  });
});
