import { describe, expect, it } from 'vitest';

import { parseArguments } from '../sim/seminarCli';

describe('seminar CLI arguments', () => {
  it('accepts a configured catalogue of leader styles', () => {
    const options = parseArguments(['--catalogue=servant,supportive,tanker']);

    expect(options.catalogue).toEqual(['servant', 'supportive', 'tanker']);
  });

  it('names an invalid catalogue entry', () => {
    expect(() => parseArguments(['--catalogue=servant,not-a-leader'])).toThrow(
      'not-a-leader',
    );
  });

  it('parses captivity controls without changing their defaults', () => {
    expect(parseArguments([]).captivity).toBe(false);
    expect(
      parseArguments(['--captivity=true', '--captivity-decay=4']),
    ).toMatchObject({
      captivity: true,
      captivityDecay: 4,
    });
  });

  it('validates captivity controls', () => {
    expect(() => parseArguments(['--captivity=maybe'])).toThrow(
      '--captivity must be true or false',
    );
    expect(() => parseArguments(['--captivity-decay=-1'])).toThrow(
      '--captivity-decay must be a non-negative integer',
    );
  });
});
