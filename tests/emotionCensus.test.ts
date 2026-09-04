import { describe, expect, it } from 'vitest';

import { ENGINE_CONFIG } from '../src/psychology/config';
import {
  buildIncidenceTable,
  parseEmotionCensusArgs,
  withPatchedEngineConfig,
} from '../sim/emotionCensus';

describe('emotion census helpers', () => {
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
      panicFloor: 0,
      relief: 0,
      guiltSafetyFloor: 0,
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
    expect(() => parseEmotionCensusArgs(['--unknown=1'])).toThrow(
      'Unrecognised flag',
    );
    expect(() => parseEmotionCensusArgs(['--weeks=bad'])).toThrow(
      'positive integer',
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
