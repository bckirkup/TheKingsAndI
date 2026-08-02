import { describe, expect, it } from 'vitest';

import { renderCsv, runSimulation } from '../sim/cli';

describe('simulation harness golden output', () => {
  it('renders a fixed CSV for a fixed configuration', () => {
    const csv = renderCsv(
      runSimulation({ matches: 2, leader: 'tyrannical', seed: 7 }),
    );
    expect(csv).toBe(
      'match,seed,leader,placeholder_score\n1,7,tyrannical,63702\n2,7,tyrannical,912434\n',
    );
  });

  it('is byte-identical when repeated with the same seed', () => {
    const options = { matches: 4, leader: 'supportive' as const, seed: 12 };
    expect(renderCsv(runSimulation(options))).toBe(
      renderCsv(runSimulation(options)),
    );
  });
});

describe('simulation harness sensitivity', () => {
  it('changes output when seed changes', () => {
    expect(
      renderCsv(runSimulation({ matches: 2, leader: 'random', seed: 1 })),
    ).not.toBe(
      renderCsv(runSimulation({ matches: 2, leader: 'random', seed: 2 })),
    );
  });

  it('changes output when leader changes', () => {
    expect(
      renderCsv(runSimulation({ matches: 2, leader: 'random', seed: 1 })),
    ).not.toBe(
      renderCsv(runSimulation({ matches: 2, leader: 'redeemer', seed: 1 })),
    );
  });
});
