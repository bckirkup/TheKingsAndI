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
});
